import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { createIssueSchema, parseBody } from '@/lib/validation'

const AUTO_ACCEPT_REVIEW_AFTER_MS = 3 * 24 * 60 * 60 * 1000
const RISK_TERMS = /critical|kritisch|finance|geld|zahlung|rechnung|legal|vertrag|publish|veröffentlichen|posten|delete|löschen|security|credential|token|oauth|extern|kunde|client/i
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

type IssueRow = Record<string, unknown> & {
  id: string
  issue_key?: string
  title?: string
  status?: string
  priority?: string
  labels?: string[] | null
  project?: string | null
  project_id?: string | null
  description?: string | null
  next_action?: string | null
  acceptance_criteria?: string | null
  updated_at?: string | null
  created_at?: string | null
  completed_at?: string | null
}

function isRiskyReview(issue: IssueRow): boolean {
  if (issue.priority === 'critical') return true
  const text = [
    issue.title,
    issue.description,
    issue.project,
    issue.next_action,
    issue.acceptance_criteria,
    ...(issue.labels || []),
  ].filter(Boolean).join('\n')
  return RISK_TERMS.test(text)
}

function isAutoAcceptableReview(issue: IssueRow): boolean {
  if (issue.status !== 'in_review') return false
  if (isRiskyReview(issue)) return false
  const reviewSince = issue.updated_at || issue.created_at
  if (!reviewSince) return false
  return Date.now() - new Date(reviewSince).getTime() >= AUTO_ACCEPT_REVIEW_AFTER_MS
}

async function autoAcceptStaleReviews(supabase: ReturnType<typeof createServerSupabase>, issues: IssueRow[]) {
  const staleReviews = issues.filter(isAutoAcceptableReview)
  if (staleReviews.length === 0) return issues

  const now = new Date().toISOString()
  await Promise.all(staleReviews.map(async issue => {
    const { error } = await supabase
      .from('issues')
      .update({ status: 'done', completed_at: now })
      .eq('id', issue.id)
      .eq('status', 'in_review')

    if (!error) {
      await supabase
        .from('issue_comments')
        .insert({
          issue_id: issue.id,
          author: 'system',
          content: escapeHtml('Automatisch akzeptiert nach 3 Tagen ohne Review-Feedback.'),
        })
    }
  }))

  return issues.map(issue => staleReviews.some(stale => stale.id === issue.id)
    ? { ...issue, status: 'done', completed_at: now, updated_at: now }
    : issue)
}

// GET /api/agents/issues?status=todo&agent=researcher&priority=high&project=xxx&archived=false&date_from=2026-01-01&date_to=2026-12-31&limit=50
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  if (isDemoMode) {
    return NextResponse.json({
      issues: [
        {
          id: 'demo-task-1',
          issue_key: 'AH-1',
          title: 'Review the first demo briefing workflow',
          description: 'Demo task for checking how tasks move through the Mana Hub.',
          status: 'in_progress',
          priority: 'high',
          agent_name: 'researcher',
          reviewer_agent: 'orchestrator',
          project: 'Demo Workspace',
          project_id: null,
          labels: ['demo', 'briefing'],
          created_by: 'demo',
          created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          updated_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
          started_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          completed_at: null,
          archived: false,
        },
        {
          id: 'demo-task-2',
          issue_key: 'AH-2',
          title: 'Approve risky automation change',
          description: 'Demo item showing how risky work can be routed to Risk Approval.',
          status: 'in_review',
          priority: 'critical',
          agent_name: 'builder',
          reviewer_agent: 'orchestrator',
          project: 'Demo Workspace',
          project_id: null,
          labels: ['demo', 'risk'],
          created_by: 'demo',
          created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
          updated_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
          started_at: null,
          completed_at: null,
          archived: false,
        },
      ],
    })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const agent = searchParams.get('agent')
  const priority = searchParams.get('priority')
  const project = searchParams.get('project')
  const archived = searchParams.get('archived')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)

  const supabase = createServerSupabase()

  const selectFields = 'id, issue_key, title, description, status, priority, agent_name, reviewer_agent, project, project_id, labels, goal_id, due_at, acceptance_criteria, next_action, blocked_reason, source_type, source_id, created_by, created_at, updated_at, started_at, completed_at, archived'
  const selectFallback = 'id, issue_key, title, description, status, priority, agent_name, project, labels, goal_id, created_by, created_at, started_at, completed_at'

  let query = supabase
    .from('issues')
    .select(selectFields)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (agent) query = query.eq('agent_name', agent)
  if (priority) query = query.eq('priority', priority)
  if (project) query = UUID_RE.test(project) ? query.eq('project_id', project) : query.eq('project', project)
  if (archived !== null) query = query.eq('archived', archived === 'true')
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59.999Z')

  const { data: initialData, error } = await query
  let data = initialData

  if (error) {
    let q2 = supabase.from('issues').select(selectFallback).order('created_at', { ascending: false }).limit(limit)
    if (status) q2 = q2.eq('status', status)
    if (agent) q2 = q2.eq('agent_name', agent)
    if (priority) q2 = q2.eq('priority', priority)
    if (project) q2 = UUID_RE.test(project) ? q2.eq('project_id', project) : q2.eq('project', project)
    if (dateFrom) q2 = q2.gte('created_at', dateFrom)
    if (dateTo) q2 = q2.lte('created_at', dateTo + 'T23:59:59.999Z')
    const res2 = await q2
    if (res2.error) {
      console.error('Error fetching issues:', res2.error)
      return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 })
    }
    data = res2.data.map(r => ({
      ...r,
      reviewer_agent: null,
      archived: false,
      project_id: null,
      due_at: null,
      acceptance_criteria: null,
      next_action: null,
      blocked_reason: null,
      source_type: null,
      source_id: null,
      updated_at: r.created_at,
    }))
  }

  const issues = await autoAcceptStaleReviews(supabase, (data || []) as IssueRow[])

  return NextResponse.json({ issues })
}

// POST /api/agents/issues
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseBody(createIssueSchema, body)
  if (!parsed.success) return parsed.response

  const {
    title,
    description,
    status,
    priority,
    agent_name,
    reviewer_agent,
    project,
    labels,
    goal_id,
    due_at,
    acceptance_criteria,
    next_action,
    blocked_reason,
    source_type,
    source_id,
    planning_context,
  } = parsed.data
  const supabase = createServerSupabase()

  const MAX_PLANNING_CONTEXT_BYTES = 100_000
  let sanitizedPlanningContext = null
  if (planning_context) {
    const contextStr = JSON.stringify(planning_context)
    if (new TextEncoder().encode(contextStr).length <= MAX_PLANNING_CONTEXT_BYTES) {
      sanitizedPlanningContext = planning_context
    }
  }

  let projectId: string | null = null
  if (project) {
    let workspaceQuery = supabase
      .from('projects')
      .select('id, slug, name')
      .or(`slug.eq.${project},name.eq.${project}`)

    if (UUID_RE.test(project)) {
      workspaceQuery = supabase
        .from('projects')
        .select('id, slug, name')
        .or(`slug.eq.${project},name.eq.${project},id.eq.${project}`)
    }

    const { data: workspace } = await workspaceQuery.maybeSingle()

    projectId = workspace?.id || null
  }

  const createdBy = (auth as { id: string; email: string }).email.split('@')[0]
  const baseRow = {
    issue_key: '',
    title: escapeHtml(title),
    description: description ? escapeHtml(description) : null,
    status,
    priority,
    agent_name: agent_name ?? null,
    project: project ?? null,
    labels,
    goal_id: goal_id ?? null,
    created_by: createdBy,
  }

  const workflowRow = {
    ...baseRow,
    project_id: projectId,
    due_at: due_at ?? null,
    acceptance_criteria: acceptance_criteria ? escapeHtml(acceptance_criteria) : null,
    next_action: next_action ? escapeHtml(next_action) : null,
    blocked_reason: blocked_reason ? escapeHtml(blocked_reason) : null,
    source_type: source_type ?? 'manual',
    source_id: source_id ?? null,
  }

  const extendedRow = {
    ...workflowRow,
    reviewer_agent: reviewer_agent ?? null,
    ...(sanitizedPlanningContext ? { planning_context: sanitizedPlanningContext } : {}),
  }

  const { data: insertedData, error } = await supabase
    .from('issues')
    .insert(extendedRow)
    .select()
    .single()
  let data = insertedData

  if (error) {
    const res2 = await supabase.from('issues').insert(baseRow).select().single()
    if (res2.error) {
      console.error('Error creating issue:', res2.error)
      return NextResponse.json({ error: 'Failed to create issue' }, { status: 500 })
    }
    data = res2.data
  }

  return NextResponse.json({ issue: data }, { status: 201 })
}

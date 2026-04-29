import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { createGoalSchema, parseBody } from '@/lib/validation'

const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type GoalRow = Record<string, unknown> & {
  id: string
  title: string
  description: string | null
  level: string
  parent_id: string | null
  project?: string | null
  project_id?: string | null
  agent_name: string | null
  status: string
  progress?: number | null
  target_value?: number | null
  current_value?: number | null
  unit?: string | null
  deadline?: string | null
  tracking_source?: 'live_api' | 'agent_report' | 'manual' | 'not_connected' | null
  confidence?: 'high' | 'medium' | 'low' | null
  source_label?: string | null
  last_checked_at?: string | null
}

function deriveProgress(goal: GoalRow) {
  const target = Number(goal.target_value)
  const current = Number(goal.current_value)
  if (Number.isFinite(target) && target > 0 && Number.isFinite(current)) {
    return Math.max(0, Math.min(100, Math.round((current / target) * 100)))
  }
  return Number(goal.progress || 0)
}

function normalizeGoal(goal: GoalRow, taskCount: number, completedTaskCount: number) {
  return {
    ...goal,
    progress: deriveProgress(goal),
    target_value: goal.target_value ?? null,
    current_value: goal.current_value ?? null,
    unit: goal.unit ?? null,
    deadline: goal.deadline ?? null,
    tracking_source: goal.tracking_source ?? 'not_connected',
    confidence: goal.confidence ?? (goal.tracking_source === 'live_api' ? 'high' : 'low'),
    source_label: goal.source_label ?? null,
    last_checked_at: goal.last_checked_at ?? null,
    task_count: taskCount,
    completed_task_count: completedTaskCount,
  }
}

async function resolveProjectId(supabase: ReturnType<typeof createServerSupabase>, project?: string | null, projectId?: string | null) {
  if (projectId) return projectId
  if (!project) return null

  let query = supabase
    .from('projects')
    .select('id, slug, name')
    .or(`slug.eq.${project},name.eq.${project}`)

  if (UUID_RE.test(project)) {
    query = supabase
      .from('projects')
      .select('id, slug, name')
      .or(`slug.eq.${project},name.eq.${project},id.eq.${project}`)
  }

  const { data } = await query.maybeSingle()
  return data?.id || null
}

// GET /api/agents/goals?level=company&agent=researcher
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { searchParams } = new URL(request.url)
  const level = searchParams.get('level')
  const agent = searchParams.get('agent')
  const project = searchParams.get('project')

  if (isDemoMode) {
    const goals = [
      normalizeGoal({
        id: 'demo-goal-1',
        title: 'Install a self-hosted Mana Hub',
        description: 'Demo outcome that shows how goals connect to workspaces and tasks.',
        level: 'company',
        parent_id: null,
        project: 'starter-setup',
        project_id: 'demo-workspace-1',
        agent_name: agent || 'orchestrator',
        status: 'active',
        progress: 62,
        target_value: 100,
        current_value: 62,
        unit: 'percent',
        deadline: null,
        tracking_source: 'manual',
        confidence: 'medium',
        source_label: 'Demo data',
        last_checked_at: new Date().toISOString(),
      }, 2, 1),
    ]
    const filtered = goals.filter(goal =>
      (!level || goal.level === level) &&
      (!agent || goal.agent_name === agent) &&
      (!project || goal.project === project || goal.project_id === project)
    )
    return NextResponse.json({ goals: filtered, tree: filtered })
  }

  const supabase = createServerSupabase()

  let query = supabase
    .from('goals')
    .select('*')
    .order('level', { ascending: true })
    .order('created_at', { ascending: true })

  if (level) query = query.eq('level', level)
  if (agent) query = query.eq('agent_name', agent)
  if (project) query = UUID_RE.test(project) ? query.eq('project_id', project) : query.eq('project', project)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching goals:', error)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }

  const goals = (data || []) as GoalRow[]
  const { data: issues } = goals.length > 0
    ? await supabase
      .from('issues')
      .select('id, goal_id, status')
      .in('goal_id', goals.map(goal => goal.id))
    : { data: [] }

  const taskCounts = new Map<string, { total: number; completed: number }>()
  for (const issue of issues || []) {
    const goalId = issue.goal_id as string | null
    if (!goalId) continue
    const current = taskCounts.get(goalId) || { total: 0, completed: 0 }
    current.total += 1
    if (issue.status === 'done') current.completed += 1
    taskCounts.set(goalId, current)
  }

  const enrichedGoals = goals.map(goal => {
    const counts = taskCounts.get(goal.id) || { total: 0, completed: 0 }
    return normalizeGoal(goal, counts.total, counts.completed)
  })

  const rootGoals = enrichedGoals.filter(g => !g.parent_id)
  const childMap: Record<string, typeof enrichedGoals> = {}

  for (const g of enrichedGoals) {
    if (g.parent_id) {
      if (!childMap[g.parent_id]) childMap[g.parent_id] = []
      childMap[g.parent_id].push(g)
    }
  }

  function buildTree(goal: (typeof enrichedGoals)[0]): unknown {
    return {
      ...goal,
      children: (childMap[goal.id] || []).map(buildTree),
    }
  }

  const tree = rootGoals.map(buildTree)

  return NextResponse.json({ goals: enrichedGoals, tree })
}

// POST /api/agents/goals
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (isDemoMode && body && typeof body === 'object' && !Array.isArray(body)) {
    const input = body as Record<string, unknown>
    const title = typeof input.title === 'string' ? input.title.trim() : ''
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
    const now = new Date().toISOString()
    return NextResponse.json({
      goal: normalizeGoal({
        id: `demo-goal-${Date.now()}`,
        title: escapeHtml(title),
        description: typeof input.description === 'string' ? escapeHtml(input.description) : null,
        level: typeof input.level === 'string' ? input.level : 'project',
        parent_id: null,
        project: typeof input.project === 'string' ? input.project : null,
        project_id: typeof input.project_id === 'string' ? input.project_id : null,
        agent_name: typeof input.agent_name === 'string' ? input.agent_name : null,
        status: 'active',
        target_value: typeof input.target_value === 'number' ? input.target_value : null,
        current_value: typeof input.current_value === 'number' ? input.current_value : null,
        unit: typeof input.unit === 'string' ? input.unit : null,
        deadline: typeof input.deadline === 'string' ? input.deadline : null,
        tracking_source: 'manual',
        confidence: 'low',
        source_label: 'Demo data',
        last_checked_at: now,
        created_at: now,
      }, 0, 0),
    }, { status: 201 })
  }

  const parsed = parseBody(createGoalSchema, body)
  if (!parsed.success) return parsed.response

  const {
    title,
    description,
    level,
    parent_id,
    project,
    project_id,
    agent_name,
    target_value,
    current_value,
    unit,
    deadline,
    tracking_source,
    confidence,
    source_label,
    last_checked_at,
  } = parsed.data

  if (isDemoMode) {
    const now = new Date().toISOString()
    return NextResponse.json({
      goal: normalizeGoal({
        id: `demo-goal-${Date.now()}`,
        title: escapeHtml(title),
        description: description ? escapeHtml(description) : null,
        level,
        parent_id: parent_id ?? null,
        project: project ?? null,
        project_id: project_id ?? null,
        agent_name: agent_name ?? null,
        status: 'active',
        target_value: target_value ?? null,
        current_value: current_value ?? null,
        unit: unit ?? null,
        deadline: deadline ?? null,
        tracking_source,
        confidence,
        source_label: source_label ?? 'Demo data',
        last_checked_at: last_checked_at ?? now,
        created_at: now,
      }, 0, 0),
    }, { status: 201 })
  }

  const supabase = createServerSupabase()
  const resolvedProjectId = await resolveProjectId(supabase, project, project_id)

  const row = {
    title: escapeHtml(title),
    description: description ? escapeHtml(description) : null,
    level,
    parent_id: parent_id ?? null,
    project: project ?? null,
    project_id: resolvedProjectId,
    agent_name: agent_name ?? null,
    target_value: target_value ?? null,
    current_value: current_value ?? null,
    unit: unit ? escapeHtml(unit) : null,
    deadline: deadline ?? null,
    tracking_source,
    confidence,
    source_label: source_label ? escapeHtml(source_label) : null,
    last_checked_at: last_checked_at ?? null,
  }

  const { data: insertedData, error } = await supabase
    .from('goals')
    .insert(row)
    .select()
    .single()
  let data = insertedData

  if (error) {
    const fallback = await supabase
      .from('goals')
      .insert({
        title: escapeHtml(title),
        description: description ? escapeHtml(description) : null,
        level,
        parent_id: parent_id ?? null,
        project: project ?? null,
        agent_name: agent_name ?? null,
      })
      .select()
      .single()

    if (fallback.error) {
      console.error('Error creating goal:', fallback.error)
      return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
    }
    data = fallback.data
  }

  return NextResponse.json({ goal: data }, { status: 201 })
}

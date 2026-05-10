import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

type WorkspaceProject = {
  id: string
  slug: string
  name: string
  created_at: string
  updated_at?: string | null
  owner_agent?: string | null
}

type WorkspaceIssue = {
  id: string
  status: string | null
  priority?: string | null
  agent_name?: string | null
  reviewer_agent?: string | null
  project_id?: string | null
  project?: string | null
  updated_at?: string | null
  created_at?: string | null
}

type WorkspaceGoal = {
  id: string
  status: string | null
  agent_name?: string | null
  progress?: number | null
  target_value?: number | null
  current_value?: number | null
  project_id?: string | null
  project?: string | null
  updated_at?: string | null
  created_at?: string | null
}

function belongsToWorkspace(row: { project_id?: string | null; project?: string | null }, project: WorkspaceProject) {
  const legacyProject = row.project?.toLowerCase()
  return row.project_id === project.id || legacyProject === project.slug.toLowerCase() || legacyProject === project.name.toLowerCase()
}

function deriveGoalProgress(goal: WorkspaceGoal) {
  const target = Number(goal.target_value)
  const current = Number(goal.current_value)
  if (Number.isFinite(target) && target > 0 && Number.isFinite(current)) {
    return Math.max(0, Math.min(100, Math.round((current / target) * 100)))
  }
  return Math.max(0, Math.min(100, Math.round(Number(goal.progress || 0))))
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const supabase = createServerSupabase()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  if (isDemoMode) {
    return NextResponse.json({
      projects: [
        {
          id: 'demo-workspace-1',
          slug: 'starter-setup',
          name: 'Starter Setup Workspace',
          description: 'Demo workspace for validating onboarding, agents, jobs, and skills.',
          status: status || 'active',
          color: '#10B981',
          owner_agent: 'orchestrator',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assigned_agents: ['orchestrator', 'researcher', 'builder'],
          issue_count: 2,
          open_issue_count: 1,
          live_issue_count: 1,
          review_issue_count: 1,
          blocked_issue_count: 0,
          critical_issue_count: 1,
          goal_count: 1,
          active_goal_count: 1,
          average_goal_progress: 62,
          last_activity_at: new Date().toISOString(),
          review_status: 'needs_attention',
          next_review_hint: 'Demo Review starten',
        },
      ],
    })
  }

  let query = supabase.from('projects').select('*').order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Projects fetch error:', error.message)
    return NextResponse.json({ projects: [], error: 'Failed to fetch projects' }, { status: 500 })
  }

  const [issueRes, goalRes] = await Promise.all([
    supabase.from('issues').select('id, status, priority, agent_name, reviewer_agent, project_id, project, updated_at, created_at'),
    supabase.from('goals').select('id, status, agent_name, progress, target_value, current_value, project_id, project, updated_at, created_at'),
  ])

  const issues = (issueRes.data || []) as WorkspaceIssue[]
  const goals = (goalRes.data || []) as WorkspaceGoal[]

  const projects = ((data || []) as WorkspaceProject[]).map((p) => {
    const workspaceIssues = issues.filter(issue => belongsToWorkspace(issue, p))
    const workspaceGoals = goals.filter(goal => belongsToWorkspace(goal, p))
    const openIssues = workspaceIssues.filter(issue => ['todo', 'in_progress'].includes(issue.status || ''))
    const reviewIssues = workspaceIssues.filter(issue => issue.status === 'in_review')
    const blockedIssues = workspaceIssues.filter(issue => issue.status === 'blocked')
    const criticalIssues = workspaceIssues.filter(issue => issue.priority === 'critical')
    const activeGoals = workspaceGoals.filter(goal => goal.status !== 'completed')
    const progressValues = activeGoals.map(deriveGoalProgress)
    const averageGoalProgress = progressValues.length
      ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
      : 0
    const lastActivity = workspaceIssues
      .map(issue => issue.updated_at || issue.created_at)
      .concat(workspaceGoals.map(goal => goal.updated_at || goal.created_at))
      .filter(Boolean)
      .sort()
      .at(-1)
    const assignedAgents = Array.from(new Set([
      p.owner_agent || null,
      ...workspaceIssues.flatMap(issue => [issue.agent_name || null, issue.reviewer_agent || null]),
      ...workspaceGoals.map(goal => goal.agent_name || null),
    ].filter(Boolean)))
    const reviewStatus = blockedIssues.length > 0 || criticalIssues.length > 0 || reviewIssues.length > 0
      ? 'needs_attention'
      : openIssues.length > 0 || activeGoals.length > 0
        ? 'active'
        : 'quiet'

    return {
      ...p,
      assigned_agents: assignedAgents,
      issue_count: workspaceIssues.length,
      open_issue_count: openIssues.length,
      live_issue_count: workspaceIssues.filter(issue => issue.status === 'in_progress').length,
      review_issue_count: reviewIssues.length,
      blocked_issue_count: blockedIssues.length,
      critical_issue_count: criticalIssues.length,
      goal_count: workspaceGoals.length,
      active_goal_count: activeGoals.length,
      average_goal_progress: averageGoalProgress,
      last_activity_at: lastActivity || p.created_at,
      review_status: reviewStatus,
      next_review_hint: reviewStatus === 'needs_attention' ? 'jetzt pruefen' : 'regelmaessig pruefen',
    }
  })

  return NextResponse.json({ projects })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const body = await request.json()
  const { name, description, color, owner_agent } = body

  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  if (isDemoMode) {
    return NextResponse.json({
      project: {
        id: `demo-${slug || 'workspace'}`,
        slug,
        name,
        description: description || null,
        color: color || '#10B981',
        owner_agent: owner_agent || null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }, { status: 201 })
  }

  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('projects')
    .insert({ slug, name, description, color: color || '#8B5CF6', owner_agent: owner_agent || null })
    .select()
    .single()

  if (error) {
    console.error('Project create error:', error.message)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }

  return NextResponse.json({ project: data }, { status: 201 })
}

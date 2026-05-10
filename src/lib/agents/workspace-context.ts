import { createServerSupabase } from '@/lib/supabase'

type WorkspaceProject = {
  id: string
  slug?: string | null
  name: string
  description?: string | null
  status?: string | null
  owner_agent?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type WorkspaceIssue = {
  id: string
  title?: string | null
  description?: string | null
  status?: string | null
  priority?: string | null
  agent_name?: string | null
  reviewer_agent?: string | null
  project?: string | null
  project_id?: string | null
  next_action?: string | null
  blocked_reason?: string | null
  updated_at?: string | null
  created_at?: string | null
}

type WorkspaceGoal = {
  id: string
  title?: string | null
  status?: string | null
  project?: string | null
  project_id?: string | null
  agent_name?: string | null
  progress?: number | null
  target_value?: number | null
  current_value?: number | null
  unit?: string | null
  tracking_source?: string | null
  confidence?: string | null
  updated_at?: string | null
  created_at?: string | null
}

export type WorkspaceContext = {
  project: WorkspaceProject
  ownerAgent: string | null
  participatingAgents: string[]
  metrics: {
    openIssues: number
    liveIssues: number
    reviewIssues: number
    blockedIssues: number
    criticalIssues: number
    activeGoals: number
    averageGoalProgress: number
    lastActivityAt: string | null
    reviewStatus: 'needs_attention' | 'active' | 'quiet'
  }
  prompt: string
}

const OPEN_STATUSES = new Set(['todo', 'in_progress', 'in_review', 'blocked'])

function belongsToWorkspace(row: { project_id?: string | null; project?: string | null }, project: WorkspaceProject) {
  const slug = project.slug?.toLowerCase()
  const legacyProject = row.project?.toLowerCase()
  return row.project_id === project.id || legacyProject === slug || legacyProject === project.name.toLowerCase()
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return [...new Map(rows.map(row => [row.id, row])).values()]
}

function deriveGoalProgress(goal: WorkspaceGoal) {
  const target = Number(goal.target_value)
  const current = Number(goal.current_value)
  if (Number.isFinite(target) && target > 0 && Number.isFinite(current)) {
    return Math.max(0, Math.min(100, Math.round((current / target) * 100)))
  }
  return Math.max(0, Math.min(100, Math.round(Number(goal.progress || 0))))
}

function compact(lines: Array<string | null | undefined>) {
  return lines.filter(Boolean).join('\n')
}

function formatIssue(issue: WorkspaceIssue) {
  return compact([
    `- ${issue.title || 'Untitled task'} (${issue.status || 'unknown'}, ${issue.priority || 'medium'})`,
    issue.agent_name ? `  Agent: ${issue.agent_name}` : null,
    issue.next_action ? `  Next action: ${issue.next_action}` : null,
    issue.blocked_reason ? `  Blocker: ${issue.blocked_reason}` : null,
  ])
}

function formatGoal(goal: WorkspaceGoal) {
  return compact([
    `- ${goal.title || 'Untitled outcome'} (${goal.status || 'active'}, ${deriveGoalProgress(goal)}%)`,
    goal.tracking_source ? `  Tracking: ${goal.tracking_source}${goal.confidence ? ` / ${goal.confidence}` : ''}` : null,
  ])
}

export async function buildWorkspaceContext(projectId: string): Promise<WorkspaceContext> {
  const supabase = createServerSupabase()
  const { data: project, error } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (error || !project) throw new Error('Workspace not found')

  const workspace = project as WorkspaceProject
  const [linkedIssuesRes, legacyIssuesRes, linkedGoalsRes, legacyGoalsRes] = await Promise.all([
    supabase.from('issues').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('issues').select('*').in('project', [workspace.slug || workspace.name, workspace.name]).order('created_at', { ascending: false }),
    supabase.from('goals').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    supabase.from('goals').select('*').in('project', [workspace.slug || workspace.name, workspace.name]).order('created_at', { ascending: false }),
  ])

  const issues = uniqueById([
    ...((linkedIssuesRes.data || []) as WorkspaceIssue[]),
    ...((legacyIssuesRes.data || []) as WorkspaceIssue[]),
  ]).filter(row => belongsToWorkspace(row, workspace))
  const goals = uniqueById([
    ...((linkedGoalsRes.data || []) as WorkspaceGoal[]),
    ...((legacyGoalsRes.data || []) as WorkspaceGoal[]),
  ]).filter(row => belongsToWorkspace(row, workspace))

  const participatingAgents = Array.from(new Set([
    workspace.owner_agent || null,
    ...issues.flatMap(issue => [issue.agent_name || null, issue.reviewer_agent || null]),
    ...goals.map(goal => goal.agent_name || null),
  ].filter((agent): agent is string => Boolean(agent))))

  const openIssues = issues.filter(issue => OPEN_STATUSES.has(issue.status || ''))
  const liveIssues = issues.filter(issue => issue.status === 'in_progress')
  const reviewIssues = issues.filter(issue => issue.status === 'in_review')
  const blockedIssues = issues.filter(issue => issue.status === 'blocked')
  const criticalIssues = issues.filter(issue => issue.priority === 'critical')
  const activeGoals = goals.filter(goal => goal.status !== 'completed')
  const progressValues = activeGoals.map(deriveGoalProgress)
  const averageGoalProgress = progressValues.length
    ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
    : 0
  const reviewStatus: WorkspaceContext['metrics']['reviewStatus'] = blockedIssues.length > 0 || criticalIssues.length > 0 || reviewIssues.length > 0
    ? 'needs_attention'
    : openIssues.length > 0 || activeGoals.length > 0
      ? 'active'
      : 'quiet'
  const lastActivityAt = [
    workspace.updated_at,
    workspace.created_at,
    ...issues.map(issue => issue.updated_at || issue.created_at || null),
    ...goals.map(goal => goal.updated_at || goal.created_at || null),
  ].filter((value): value is string => Boolean(value)).sort().at(-1) || null

  const ownerAgent = workspace.owner_agent || participatingAgents[0] || null
  const prompt = compact([
    `Workspace Review: ${workspace.name}`,
    '',
    'Review this workspace as the responsible agent. Identify risks, blocked work, missing outcomes, and the next concrete follow-ups.',
    '',
    `Owner-Agent: ${ownerAgent || 'not set'}`,
    `Open tasks: ${openIssues.length}`,
    `Blocked tasks: ${blockedIssues.length}`,
    `In review: ${reviewIssues.length}`,
    `Active outcomes: ${activeGoals.length}`,
    `Average outcome progress: ${averageGoalProgress}%`,
    '',
    activeGoals.length ? 'Active outcomes:' : 'Active outcomes: none',
    ...activeGoals.slice(0, 8).map(formatGoal),
    '',
    openIssues.length ? 'Open work:' : 'Open work: none',
    ...openIssues.slice(0, 10).map(formatIssue),
    '',
    'Return: short status, risks, next 3 actions, and recommended task/outcome updates.',
  ])

  return {
    project: workspace,
    ownerAgent,
    participatingAgents,
    metrics: {
      openIssues: openIssues.length,
      liveIssues: liveIssues.length,
      reviewIssues: reviewIssues.length,
      blockedIssues: blockedIssues.length,
      criticalIssues: criticalIssues.length,
      activeGoals: activeGoals.length,
      averageGoalProgress,
      lastActivityAt,
      reviewStatus,
    },
    prompt,
  }
}

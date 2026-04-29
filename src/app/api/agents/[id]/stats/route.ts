import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, sanitizePathParam } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { isValidAgentName } from '@/lib/agents-meta'

// GET /api/agents/[id]/stats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const agentName = sanitizePathParam(id)?.toLowerCase()
  if (!agentName || !isValidAgentName(agentName)) {
    return NextResponse.json({ error: 'Invalid agent' }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [runsRes, issuesRes] = await Promise.all([
    supabase
      .from('issue_runs')
      .select('started_at, status')
      .eq('agent_name', agentName)
      .gte('started_at', fourteenDaysAgo),
    supabase
      .from('issues')
      .select('priority, status')
      .eq('agent_name', agentName),
  ])

  const runsByDay: Record<string, number> = {}
  const successByDay: Record<string, { succeeded: number; failed: number }> = {}

  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    runsByDay[key] = 0
    successByDay[key] = { succeeded: 0, failed: 0 }
  }

  for (const run of (runsRes.data || [])) {
    const d = new Date(run.started_at)
    const key = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    if (key in runsByDay) {
      runsByDay[key]++
      if (run.status === 'succeeded') successByDay[key].succeeded++
      if (run.status === 'failed') successByDay[key].failed++
    }
  }

  const runActivity = Object.entries(runsByDay).map(([day, count]) => ({ day, runs: count }))
  const successRate = Object.entries(successByDay).map(([day, data]) => ({ day, ...data }))

  const prioCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  const statusCounts: Record<string, number> = { done: 0, in_progress: 0, todo: 0, blocked: 0 }

  for (const i of (issuesRes.data || [])) {
    prioCounts[i.priority] = (prioCounts[i.priority] || 0) + 1
    statusCounts[i.status] = (statusCounts[i.status] || 0) + 1
  }

  const issuesByPriority = Object.entries(prioCounts).map(([priority, count]) => ({ priority, count }))
  const issuesByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

  return NextResponse.json({
    runActivity,
    issuesByPriority,
    issuesByStatus,
    successRate,
  })
}

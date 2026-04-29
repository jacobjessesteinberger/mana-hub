import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { isValidAgentName } from '@/lib/agents-meta'
import { createServerSupabase } from '@/lib/supabase'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const name = (await params).id
  if (!isValidAgentName(name)) {
    return NextResponse.json({ error: 'Invalid agent name' }, { status: 400 })
  }

  const supabase = createServerSupabase()

  const { data: issueRuns, error } = await supabase
    .from('issue_runs')
    .select('*, issues!inner(title, issue_key, priority)')
    .eq('agent_name', name)
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) {
    const fallback = await supabase
      .from('issue_runs')
      .select('*')
      .eq('agent_name', name)
      .order('started_at', { ascending: false })
      .limit(50)

    if (fallback.error) {
      return NextResponse.json({ agent: name, runs: [], total: 0 })
    }

    const runs = (fallback.data || []).map(r => ({
      id: r.id,
      session_id: r.run_id || r.id,
      agent: name,
      started_at: r.started_at,
      ended_at: r.completed_at || null,
      duration_seconds: r.started_at && r.completed_at
        ? Math.round((new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000)
        : 0,
      status: r.status === 'succeeded' ? 'success' : r.status === 'running' ? 'running' : r.status === 'failed' ? 'failed' : 'success',
      type: 'assignment',
      summary: r.output?.slice(0, 120) || 'Issue run',
      input_tokens: r.tokens_used || 0,
      output_tokens: 0,
      cost_usd: 0,
      model: 'claude-sonnet-4',
      events: [],
    }))

    return NextResponse.json({ agent: name, runs, total: runs.length })
  }

  const runs = (issueRuns || []).map(r => {
    const issue = (r as Record<string, unknown>).issues as { title?: string; issue_key?: string; priority?: string } | null
    return {
      id: r.id,
      session_id: r.run_id || r.id,
      agent: name,
      started_at: r.started_at,
      ended_at: r.completed_at || null,
      duration_seconds: r.started_at && r.completed_at
        ? Math.round((new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000)
        : 0,
      status: r.status === 'succeeded' ? 'success' : r.status === 'running' ? 'running' : r.status === 'failed' ? 'failed' : 'success',
      type: 'assignment',
      summary: issue?.title
        ? `${issue.issue_key || ''} ${issue.title}`.trim()
        : r.output?.slice(0, 120) || 'Issue run',
      input_tokens: r.tokens_used || 0,
      output_tokens: 0,
      cost_usd: 0,
      model: 'claude-sonnet-4',
      events: [],
    }
  })

  return NextResponse.json({ agent: name, runs, total: runs.length })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { normalizeAutomationRunbook } from '@/lib/agents/automation-runbook'
import { enrichRunbookSources } from '@/lib/agents/runbook-source-resolver'

const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agent')

  if (isDemoMode) {
    const jobs = [
      {
        id: 'demo-job-1',
        agent_id: 'researcher',
        name: 'Demo Morning Briefing',
        description: 'Collects relevant knowledge-base references and produces a concise briefing.',
        prompt: 'Use only the relevant headings from the demo knowledge base and produce a short morning briefing.',
        enabled: true,
        schedule_kind: 'at',
        schedule_hour: 8,
        schedule_minute: 0,
        schedule_day: null,
        schedule_expr: null,
        http_target: null,
        automation_type: 'agent_cron',
        output_kind: 'briefing',
        risk_level: 'low',
        last_status: 'success',
        consecutive_errors: 0,
        next_run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      },
    ].filter(job => !agentId || job.agent_id === agentId)

    return NextResponse.json({
      routines: jobs.map(job => {
        const runbook = normalizeAutomationRunbook(job)
        return { ...job, runbook: enrichRunbookSources(job, runbook) }
      }),
    })
  }

  const supabase = createServerSupabase()

  let query = supabase
    .from('agent_cron_jobs')
    .select('*')
    .order('agent_id')
    .order('name')

  if (agentId) {
    query = query.eq('agent_id', agentId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching routines:', error)
    return NextResponse.json({ error: 'Failed to fetch routines' }, { status: 500 })
  }

  return NextResponse.json({
    routines: (data || []).map(job => {
      const runbook = normalizeAutomationRunbook(job)
      return {
        ...job,
        runbook: enrichRunbookSources(job, runbook),
      }
    }),
  })
}

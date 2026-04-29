import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

const RISK_TERMS = /finance|geld|zahlung|rechnung|delete|löschen|http|api|extern|token|credential|kunde|client|publish|veröffentlichen|config/i
const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

function inferRiskLevel(action: string, proposedChanges: Record<string, unknown>, feedback?: string) {
  const text = `${action}\n${feedback || ''}\n${JSON.stringify(proposedChanges)}`
  if (/delete|löschen|token|credential|zahlung|kunde|client|config/i.test(text)) return 'critical'
  if (RISK_TERMS.test(text)) return 'high'
  return action === 'delete' ? 'high' : 'medium'
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthResponse(auth)) return auth

  if (isDemoMode) {
    return NextResponse.json({ requests: [] })
  }

  const supabase = createServerSupabase()
  const status = req.nextUrl.searchParams.get('status') || 'pending'

  const { data, error } = await supabase
    .from('cron_requests')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Cron requests fetch error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch cron requests' }, { status: 500 })
  }

  return NextResponse.json({ requests: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthResponse(auth)) return auth

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const agentName = String(input.agent_name || '')
  const action = String(input.action || 'update')
  const jobName = String(input.job_name || '')
  const proposedChanges = (input.proposed_changes && typeof input.proposed_changes === 'object' && !Array.isArray(input.proposed_changes))
    ? input.proposed_changes as Record<string, unknown>
    : {}
  const currentSnapshot = (input.current_snapshot && typeof input.current_snapshot === 'object' && !Array.isArray(input.current_snapshot))
    ? input.current_snapshot as Record<string, unknown>
    : {}
  const userFeedback = typeof input.user_feedback === 'string' ? input.user_feedback : ''
  const runbook = input.runbook && typeof input.runbook === 'object' && !Array.isArray(input.runbook)
    ? input.runbook as Record<string, unknown>
    : proposedChanges.runbook && typeof proposedChanges.runbook === 'object' && !Array.isArray(proposedChanges.runbook)
      ? proposedChanges.runbook as Record<string, unknown>
      : null

  if (!agentName || !jobName || !['create', 'update', 'delete'].includes(action)) {
    return NextResponse.json({ error: 'agent_name, job_name and valid action required' }, { status: 400 })
  }

  const scheduleHour = Number.isFinite(Number(input.schedule_hour)) ? Number(input.schedule_hour) : null
  const scheduleMinute = Number.isFinite(Number(input.schedule_minute)) ? Number(input.schedule_minute) : null
  const scheduleDay = input.schedule_day === null || input.schedule_day === undefined || input.schedule_day === ''
    ? null
    : Number(input.schedule_day)
  const prompt = typeof input.prompt === 'string' ? input.prompt : typeof proposedChanges.prompt === 'string' ? proposedChanges.prompt : null
  const riskLevel = typeof input.risk_level === 'string'
    ? input.risk_level
    : inferRiskLevel(action, proposedChanges, userFeedback)

  const supabase = createServerSupabase()
  const row = {
    agent_name: agentName,
    action,
    job_name: escapeHtml(jobName),
    schedule_hour: scheduleHour,
    schedule_minute: scheduleMinute,
    schedule_day: scheduleDay,
    prompt: prompt ? escapeHtml(prompt) : null,
    reason: escapeHtml(String(input.reason || userFeedback || 'Automation-Vorschlag')),
    target_job_id: input.target_job_id ? String(input.target_job_id) : null,
    request_type: input.request_type ? String(input.request_type) : action === 'create' ? 'automation_create' : action === 'delete' ? 'automation_delete' : 'automation_update',
    proposed_changes: proposedChanges,
    current_snapshot: currentSnapshot,
    user_feedback: userFeedback ? escapeHtml(userFeedback) : null,
    risk_level: riskLevel,
    source: input.source ? String(input.source) : 'manual',
    improvement_area: input.improvement_area ? String(input.improvement_area) : null,
  }
  if (runbook) {
    row.proposed_changes = {
      ...row.proposed_changes,
      runbook,
    }
  }

  const { data: insertedData, error } = await supabase
    .from('cron_requests')
    .insert(row)
    .select()
    .single()
  let data = insertedData

  if (error) {
    const fallback = await supabase
      .from('cron_requests')
      .insert({
        agent_name: row.agent_name,
        action: row.action,
        job_name: row.job_name,
        schedule_hour: row.schedule_hour,
        schedule_minute: row.schedule_minute,
        schedule_day: row.schedule_day,
        prompt: row.prompt,
        reason: row.reason,
        target_job_id: row.target_job_id,
      })
      .select()
      .single()

    if (fallback.error) {
      console.error('Cron request create error:', fallback.error.message)
      return NextResponse.json({ error: 'Failed to create cron request' }, { status: 500 })
    }
    data = fallback.data
  }

  if (['high', 'critical'].includes(riskLevel)) {
    await supabase.from('approvals').insert({
      agent_name: agentName,
      action_type: `automation.${action}`,
      action_payload: {
        cron_request_id: data.id,
        job_name: jobName,
        proposed_changes: proposedChanges,
      },
      risk_level: riskLevel,
      action_summary: escapeHtml(`Automation ${action}: ${jobName}`),
      risk_reason: escapeHtml(String(input.risk_reason || 'Riskante Automation-Änderung')),
    })
  }

  return NextResponse.json({ request: data }, { status: 201 })
}

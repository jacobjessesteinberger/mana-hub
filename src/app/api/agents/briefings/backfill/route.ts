import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import {
  enrichBriefingRow,
  isBriefingRow,
  type AgentCronJob,
  type BriefingRow,
} from '@/lib/agents/briefings'

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const body = await request.json().catch(() => ({})) as { days?: number; dry_run?: boolean }
  const days = Math.min(Math.max(Number(body.days || 14), 1), 60)
  const dryRun = body.dry_run ?? false
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const supabase = createServerSupabase()

  const { data: cronJobs, error: cronError } = await supabase
    .from('agent_cron_jobs')
    .select('id, agent_id, name, description, prompt, enabled, schedule_hour, schedule_minute, schedule_day')

  if (cronError) {
    console.error('Briefing backfill cron fetch error:', cronError.message)
    return NextResponse.json({ error: 'Failed to fetch cron jobs' }, { status: 500 })
  }

  let { data: messages, error: messageError } = await supabase
    .from('agent_messages')
    .select('id, agent_name, role, content, ticket_id, reply_to_id, created_at, metadata')
    .eq('role', 'assistant')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000)

  let metadataColumnMissing = false
  if (messageError && messageError.message.includes('metadata')) {
    metadataColumnMissing = true
    const retry = await supabase
      .from('agent_messages')
      .select('id, agent_name, role, content, ticket_id, reply_to_id, created_at')
      .eq('role', 'assistant')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1000)

    messages = retry.data?.map(row => ({ ...row, metadata: null })) || null
    messageError = retry.error
  }

  if (messageError) {
    console.error('Briefing backfill message fetch error:', messageError.message)
    return NextResponse.json({ error: 'Failed to fetch agent messages' }, { status: 500 })
  }

  const jobs = (cronJobs || []) as AgentCronJob[]
  const candidates = ((messages || []) as BriefingRow[])
    .filter(row => isBriefingRow(row, jobs))
    .map(row => enrichBriefingRow(row, jobs))

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      matched: candidates.length,
      ids: candidates.map(row => row.id),
    })
  }

  if (metadataColumnMissing) {
    return NextResponse.json({
      ok: false,
      error: 'agent_messages.metadata column missing',
      matched: candidates.length,
      migration_required: true,
      migration: 'supabase/migrations/20260426_agent_briefing_metadata.sql',
    }, { status: 409 })
  }

  const results = await Promise.all(candidates.map(async row => {
    const { error } = await supabase
      .from('agent_messages')
      .update({ metadata: row.metadata || {} })
      .eq('id', row.id)

    return { id: row.id, ok: !error, error: error?.message }
  }))

  return NextResponse.json({
    ok: results.every(result => result.ok),
    matched: candidates.length,
    updated: results.filter(result => result.ok).length,
    failed: results.filter(result => !result.ok),
  })
}

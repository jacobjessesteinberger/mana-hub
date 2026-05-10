import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, sanitizePathParam } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'

const TMUX_BIN = process.env.TMUX_BIN || 'tmux'
const AGENTS_DIR = process.env.AGENT_WORKSPACE_DIR || ''
const SESSION_NAME_RE = /^[a-zA-Z0-9_-]+$/

function notifyAgent(session: string, filename: string): boolean {
  if (!SESSION_NAME_RE.test(session)) return false
  try {
    execFileSync(TMUX_BIN, ['has-session', '-t', session], { stdio: 'ignore' })
  } catch { return false }
  try {
    const prompt = `Neue Inbox-Datei: inbox/${filename}. Lies sie, bearbeite die Anfrage gemäß deiner CLAUDE.md und schreibe deine Antwort in outbox/reply-${Date.now()}.md, dann lösche die Inbox-Datei.`
    execFileSync(TMUX_BIN, ['send-keys', '-t', session, '-l', prompt])
    execFileSync(TMUX_BIN, ['send-keys', '-t', session, 'Enter'])
    return true
  } catch { return false }
}

// PATCH /api/agents/cron-requests/[id] — approve or reject
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req)
  if (isAuthResponse(auth)) return auth

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL
  if (!ADMIN_EMAIL) {
    return NextResponse.json({ error: 'ADMIN_EMAIL not configured' }, { status: 503 })
  }
  if (auth.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const sanitizedId = sanitizePathParam(id)
  if (!sanitizedId) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  let body: { action: 'approve' | 'reject' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!['approve', 'reject'].includes(body.action)) {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  const supabase = createServerSupabase()

  const { data: request, error: fetchErr } = await supabase
    .from('cron_requests')
    .select('*')
    .eq('id', sanitizedId)
    .eq('status', 'pending')
    .single()

  if (fetchErr || !request) {
    return NextResponse.json({ error: 'Request not found or already processed' }, { status: 404 })
  }

  const now = new Date().toISOString()

  if (body.action === 'reject') {
    await supabase
      .from('cron_requests')
      .update({ status: 'rejected', reviewed_at: now, reviewed_by: auth.email })
      .eq('id', sanitizedId)

    // Notify agent
    const inboxDir = join(AGENTS_DIR, request.agent_name, 'inbox')
    if (existsSync(inboxDir)) {
      const filename = `cron-rejected-${Date.now()}.md`
      writeFileSync(join(inboxDir, filename), `---
type: system
timestamp: ${now}
---

Dein Cron-Vorschlag **${request.job_name}** wurde abgelehnt.
`)
      notifyAgent(request.agent_name, filename)
    }

    return NextResponse.json({ ok: true, status: 'rejected' })
  }

  // Approve: execute the action
  const proposed = (request.proposed_changes && typeof request.proposed_changes === 'object')
    ? request.proposed_changes as Record<string, unknown>
    : {}
  const proposedRunbook = proposed.runbook && typeof proposed.runbook === 'object' && !Array.isArray(proposed.runbook)
    ? proposed.runbook as Record<string, unknown>
    : null

  if (request.action === 'create') {
    const slug = String(request.job_name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const jobId = `cron-${request.agent_name}-${slug || Date.now()}`
    const insertPayload: Record<string, unknown> = {
      id: jobId,
      agent_id: request.agent_name,
      name: request.job_name,
      enabled: true,
      schedule_hour: request.schedule_hour,
      schedule_minute: request.schedule_minute,
      schedule_day: request.schedule_day,
      prompt: request.prompt,
      description: request.prompt?.substring(0, 200) || request.job_name,
      automation_type: proposed.http_target ? 'http_cron' : 'agent_cron',
      output_kind: proposed.output_kind || 'cron',
      risk_level: request.risk_level || 'low',
      created_by: request.agent_name,
    }
    if (proposedRunbook) {
      insertPayload.runbook = proposedRunbook
      insertPayload.runbook_updated_at = now
    }

    const { error: insertErr } = await supabase
      .from('agent_cron_jobs')
      .insert(insertPayload)

    if (insertErr) {
      console.error('Cron job create error:', insertErr.message)
      return NextResponse.json({ error: 'Failed to create cron job' }, { status: 500 })
    }
  } else if (request.action === 'update' && request.target_job_id) {
    const updates: Record<string, unknown> = { updated_at: now }
    if (request.schedule_hour != null) updates.schedule_hour = request.schedule_hour
    if (request.schedule_minute != null) updates.schedule_minute = request.schedule_minute
    if (request.schedule_day !== undefined) updates.schedule_day = request.schedule_day
    if (request.prompt) updates.prompt = request.prompt
    for (const key of ['name', 'description', 'enabled', 'automation_type', 'output_kind', 'risk_level']) {
      if (proposed[key] !== undefined) updates[key] = proposed[key]
    }
    if (typeof proposed.prompt === 'string') updates.prompt = proposed.prompt
    if (proposedRunbook) {
      updates.runbook = proposedRunbook
      updates.runbook_updated_at = now
    }
    if (typeof proposed.runbook_quality_score === 'number') updates.runbook_quality_score = proposed.runbook_quality_score
    if (Array.isArray(proposed.runbook_missing_fields)) updates.runbook_missing_fields = proposed.runbook_missing_fields
    if (typeof proposed.schedule_hour === 'number') updates.schedule_hour = proposed.schedule_hour
    if (typeof proposed.schedule_minute === 'number') updates.schedule_minute = proposed.schedule_minute
    if (proposed.schedule_day === null || typeof proposed.schedule_day === 'number') updates.schedule_day = proposed.schedule_day

    await supabase
      .from('agent_cron_jobs')
      .update(updates)
      .eq('id', request.target_job_id)
      .eq('agent_id', request.agent_name)
  } else if (request.action === 'delete' && request.target_job_id) {
    await supabase
      .from('agent_cron_jobs')
      .delete()
      .eq('id', request.target_job_id)
      .eq('agent_id', request.agent_name)
  }

  await supabase
    .from('cron_requests')
    .update({ status: 'approved', reviewed_at: now, reviewed_by: auth.email })
    .eq('id', sanitizedId)

  // Notify agent
  const inboxDir = join(AGENTS_DIR, request.agent_name, 'inbox')
  if (existsSync(inboxDir)) {
    const filename = `cron-approved-${Date.now()}.md`
    const actionLabels: Record<string, string> = { create: 'erstellt', update: 'aktualisiert', delete: 'gelöscht' }
    const actionLabel = actionLabels[request.action] || request.action
    writeFileSync(join(inboxDir, filename), `---
type: system
timestamp: ${now}
---

Dein Cron-Vorschlag **${request.job_name}** wurde genehmigt und ${actionLabel}. Deine my-cron-jobs.json wird beim nächsten Bridge-Tick aktualisiert.
`)
    notifyAgent(request.agent_name, filename)
  }

  return NextResponse.json({ ok: true, status: 'approved' })
}

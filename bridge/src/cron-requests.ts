/**
 * Bridge-side helpers for the agent-driven Cron-Request pipeline.
 *
 * When an agent writes an outbox reply with `type: cron_request` in its YAML
 * frontmatter, dispatchOutboxReply() (file-drop.ts) calls
 * insertCronRequestFromMarker() instead of the normal agent_messages insert.
 * The result is a row in `cron_requests` (status = 'pending') and a
 * `cron_request` notice in agent_messages so the dashboard chat shows what
 * happened.
 *
 * Mirrors the logic in src/app/api/agents/cron-requests/route.ts (server-side).
 * Kept here as a small duplicate because the bridge is a separate Node
 * process with its own tsconfig — cross-package imports would require build
 * orchestration we don't have set up.
 *
 * Decision flow (approve / reject) lives in the dashboard:
 * src/app/api/agents/cron-requests/[id]/route.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyDashboard } from './push.ts'

type Frontmatter = Record<string, string>

const VALID_ACTIONS = new Set(['create', 'update', 'delete'])
const RISK_TERMS = /finance|geld|zahlung|rechnung|delete|löschen|http|api|extern|token|credential|kunde|client|publish|veröffentlichen|config/i

function inferRiskLevel(action: string, payloadJson: string, feedback: string): string {
  const text = `${action}\n${feedback}\n${payloadJson}`
  if (/delete|löschen|token|credential|zahlung|kunde|client|config/i.test(text)) return 'critical'
  if (RISK_TERMS.test(text)) return 'high'
  return action === 'delete' ? 'high' : 'medium'
}

function parseInt(value: string | undefined): number | null {
  if (value === undefined || value === null || value === '' || value === 'null') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parseProposedChanges(fm: Frontmatter): Record<string, unknown> {
  if (!fm.proposed_changes) return {}
  try {
    const parsed = JSON.parse(fm.proposed_changes)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch { /* fall through */ }
  return {}
}

export interface CronRequestMarkerResult {
  cronRequestId: string | null
  approvalId: string | null
  riskLevel: string
  error?: string
}

/**
 * Insert a cron-request row when the agent's outbox reply is marked as a
 * `type: cron_request`. For `high` / `critical` risk also writes a parallel
 * row to `approvals` so it shows up in the Risk-Approval tab.
 *
 * Always writes a `cron_request` system row into agent_messages so the chat
 * thread shows what happened.
 */
export async function insertCronRequestFromMarker(
  supabase: SupabaseClient,
  agentName: string,
  fm: Frontmatter,
  body: string,
  replyToId: string | null
): Promise<CronRequestMarkerResult> {
  const action = (fm.action || 'update').toLowerCase()
  if (!VALID_ACTIONS.has(action)) {
    return {
      cronRequestId: null, approvalId: null, riskLevel: 'medium',
      error: `invalid action "${fm.action}", expected create | update | delete`,
    }
  }

  const jobName = fm.job_name?.trim()
  if (!jobName) {
    return {
      cronRequestId: null, approvalId: null, riskLevel: 'medium',
      error: 'missing job_name',
    }
  }

  const proposedChanges = parseProposedChanges(fm)
  const userFeedback = fm.user_feedback || fm.reason || body || ''
  const riskLevel = (fm.risk_level || inferRiskLevel(action, JSON.stringify(proposedChanges), userFeedback)).toLowerCase()
  const prompt = fm.prompt || (typeof proposedChanges.prompt === 'string' ? proposedChanges.prompt : null)

  const row: Record<string, unknown> = {
    agent_name: agentName,
    action,
    job_name: jobName.slice(0, 500),
    schedule_hour: parseInt(fm.schedule_hour),
    schedule_minute: parseInt(fm.schedule_minute),
    schedule_day: parseInt(fm.schedule_day),
    prompt: prompt ? String(prompt).slice(0, 5000) : null,
    reason: (fm.reason || userFeedback || 'Automation-Vorschlag').slice(0, 5000),
    target_job_id: fm.target_job_id || null,
    request_type: fm.request_type
      || (action === 'create' ? 'automation_create'
        : action === 'delete' ? 'automation_delete'
          : 'automation_update'),
    proposed_changes: proposedChanges,
    user_feedback: userFeedback ? userFeedback.slice(0, 5000) : null,
    risk_level: riskLevel,
    source: fm.source || 'agent_outbox',
    improvement_area: fm.improvement_area || null,
  }

  const { data: insertedData, error } = await supabase
    .from('cron_requests')
    .insert(row)
    .select('id')
    .single()
  let data = insertedData

  if (error || !data) {
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
      .select('id')
      .single()
    if (fallback.error || !fallback.data) {
      console.error('[bridge-cron-requests] failed to insert cron request:', fallback.error?.message)
      return {
        cronRequestId: null, approvalId: null, riskLevel,
        error: fallback.error?.message || 'insert failed',
      }
    }
    data = fallback.data
  }

  const cronRequestId = data.id as string

  let approvalId: string | null = null
  if (riskLevel === 'high' || riskLevel === 'critical') {
    const { data: approvalRow, error: approvalErr } = await supabase
      .from('approvals')
      .insert({
        agent_name: agentName,
        action_type: `automation.${action}`,
        action_payload: {
          cron_request_id: cronRequestId,
          job_name: jobName,
          proposed_changes: proposedChanges,
        },
        risk_level: riskLevel,
        action_summary: `Automation ${action}: ${jobName}`.slice(0, 240),
        risk_reason: (fm.risk_reason || 'Riskante Automation-Aenderung').slice(0, 5000),
        execution_status: 'waiting_approval',
      })
      .select('id')
      .single()
    if (approvalErr) {
      console.warn('[bridge-cron-requests] approval shadow insert failed:', approvalErr.message)
    } else if (approvalRow) {
      approvalId = approvalRow.id as string
    }
  }

  const noticeLines = [
    `Cron-Request angelegt: ${jobName}`,
    `Cron-Request-ID: ${cronRequestId}`,
    `Action: ${action}`,
    `Risiko-Level: ${riskLevel}`,
  ]
  if (approvalId) noticeLines.push(`Approval-ID (parallel): ${approvalId}`)
  noticeLines.push('', 'Entscheide den Vorschlag im Routines-/Cron-Tab im Mana Hub. Bei Genehmigung wird der Cron-Job angelegt/aktualisiert/geloescht.')

  await supabase.from('agent_messages').insert({
    agent_name: agentName,
    role: 'system',
    content: noticeLines.join('\n'),
    reply_to_id: replyToId,
    metadata: {
      kind: 'cron_request',
      cron_request_id: cronRequestId,
      approval_id: approvalId,
      action,
      job_name: jobName,
      risk_level: riskLevel,
    },
  }).then(result => {
    if (result.error?.message?.includes('metadata')) {
      return supabase.from('agent_messages').insert({
        agent_name: agentName,
        role: 'system',
        content: noticeLines.join('\n'),
        reply_to_id: replyToId,
      })
    }
  })

  const verb = action === 'create'
    ? 'will einen neuen Cron-Job'
    : action === 'update' ? 'will einen Cron-Job ändern' : 'will einen Cron-Job löschen'
  void notifyDashboard({
    title: `Cron-Vorschlag: ${agentName}`,
    body: `${agentName} ${verb}: ${jobName}`,
    url: '/dashboard/agents/cron-requests',
    tag: `cron-request-${cronRequestId}`,
  })

  return { cronRequestId, approvalId, riskLevel }
}

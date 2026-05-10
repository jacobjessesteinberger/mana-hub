/**
 * Shared helpers for the Risk-Approval pipeline.
 *
 * Lives outside the API route files because both POST (create + maybe
 * auto-approve via policy) and PATCH (decide manually + maybe upgrade to
 * always-policy) need them, and Bridge-side code may need decisionMessage()
 * for tests / fallbacks.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type ApprovalDecisionStatus = 'approved' | 'rejected'

export interface ApprovalRecord {
  id: string
  agent_name: string
  action_type: string
  action_payload?: Record<string, unknown> | null
  action_summary?: string | null
  risk_level?: string | null
  related_issue_id?: string | null
}

export interface ApprovalPolicyRecord {
  id: string
  name: string
  trigger_type: string
  trigger_value: string | null
  enabled: boolean
  agent_name: string | null
  source: string
  decided_by: string | null
  use_count: number | null
  last_used_at: string | null
}

/**
 * Look up an enabled "always allow" policy that matches an incoming approval
 * request. Matching rules:
 *   - trigger_type = 'action_type'
 *   - trigger_value = exact match of the request action_type
 *   - enabled = true
 *   - agent_name is either NULL (global policy) or matches the request agent
 *
 * Returns the most-specific match (per-agent beats global) or null.
 */
export async function findMatchingAlwaysPolicy(
  supabase: SupabaseClient,
  agentName: string,
  actionType: string
): Promise<ApprovalPolicyRecord | null> {
  const { data, error } = await supabase
    .from('approval_policies')
    .select('id, name, trigger_type, trigger_value, enabled, agent_name, source, decided_by, use_count, last_used_at')
    .eq('trigger_type', 'action_type')
    .eq('trigger_value', actionType)
    .eq('enabled', true)
    .or(`agent_name.eq.${agentName},agent_name.is.null`)

  if (error) {
    console.error('[approvals] policy lookup error:', error.message)
    return null
  }
  if (!data || data.length === 0) return null

  const perAgent = data.find(row => row.agent_name === agentName)
  return (perAgent || data[0]) as ApprovalPolicyRecord
}

/**
 * Bump use_count and last_used_at on a policy after it auto-approves a request.
 * Best-effort — failure does not break the approval flow.
 */
export async function recordPolicyUse(
  supabase: SupabaseClient,
  policyId: string,
  currentUseCount: number | null
): Promise<void> {
  const { error } = await supabase
    .from('approval_policies')
    .update({
      use_count: (currentUseCount ?? 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', policyId)
  if (error) {
    console.warn('[approvals] failed to bump policy use_count:', error.message)
  }
}

/**
 * Build the natural-language message that the agent receives when an approval
 * has been decided. Returned as plain markdown — the bridge's writeInboxMessage
 * will wrap it with frontmatter (kind: risk_approval_decision, approval_id, ...).
 */
export function buildDecisionMessage(
  approval: ApprovalRecord,
  status: ApprovalDecisionStatus,
  reason?: string,
  extras?: { policyName?: string }
): string {
  const title = status === 'approved' ? 'Risk Approval genehmigt' : 'Risk Approval abgelehnt'
  const instruction = status === 'approved'
    ? 'Du darfst die beantragte Aktion jetzt ausfuehren. Nutze exakt den genehmigten Scope und dokumentiere das Ergebnis.'
    : 'Fuehre diese Aktion nicht aus. Beruecksichtige die Begruendung und schlage bei Bedarf eine risikoaermere Alternative vor.'

  const lines = [
    `${title}: ${approval.action_summary || approval.action_type}`,
    `Approval-ID: ${approval.id}`,
    `Action-Type: ${approval.action_type}`,
    `Risiko-Level: ${approval.risk_level || 'high'}`,
  ]
  if (extras?.policyName) {
    lines.push(`Auto-genehmigt durch Policy: ${extras.policyName}`)
  }
  if (reason) {
    lines.push(`Begruendung:`, reason)
  } else {
    lines.push(`Keine zusaetzliche Begruendung hinterlegt.`)
  }
  lines.push('', instruction)
  return lines.join('\n')
}

/**
 * Insert the decision into agent_messages so the bridge picks it up and
 * delivers it to the agent. Includes metadata.kind = 'risk_approval_decision'
 * + approval_id + decision + action_type so writeInboxMessage can promote
 * those into YAML frontmatter (Bridge-side change in this same release).
 *
 * Has a fallback for environments where agent_messages does not yet have a
 * metadata column (mirrors the existing PATCH route behaviour).
 */
export async function insertDecisionMessage(
  supabase: SupabaseClient,
  approval: ApprovalRecord,
  status: ApprovalDecisionStatus,
  reason: string | null,
  extras?: { policyName?: string }
): Promise<void> {
  const content = buildDecisionMessage(approval, status, reason ?? undefined, extras)
  const result = await supabase.from('agent_messages').insert({
    agent_name: approval.agent_name,
    role: 'user',
    content,
    metadata: {
      kind: 'risk_approval_decision',
      approval_id: approval.id,
      decision: status,
      action_type: approval.action_type,
      action_summary: approval.action_summary || null,
      auto_approved: !!extras?.policyName,
      policy_name: extras?.policyName || null,
    },
  })
  if (result.error?.message?.includes('metadata')) {
    await supabase.from('agent_messages').insert({
      agent_name: approval.agent_name,
      role: 'user',
      content,
    })
  } else if (result.error) {
    console.error('[approvals] decision message insert error:', result.error.message)
  }
}

/**
 * Insert a "MANA hat eine Approval angefragt"-Hinweis into agent_messages so
 * the chat thread shows it (otherwise the user only sees the request in the
 * Approvals tab and not in the conversation that triggered it).
 *
 * The message is role='system' with metadata.kind='risk_approval_request'.
 * Bridge-side: writeInboxMessage suppresses re-delivery to the agent's inbox
 * for kind='risk_approval_request' (the agent already wrote it themselves).
 */
export async function insertRequestNotice(
  supabase: SupabaseClient,
  approval: ApprovalRecord,
  replyToId: string | null
): Promise<void> {
  const content = [
    `Risk Approval angefragt: ${approval.action_summary || approval.action_type}`,
    `Approval-ID: ${approval.id}`,
    `Risiko-Level: ${approval.risk_level || 'high'}`,
    '',
    'Entscheide dich im Risk-Approval-Tab im Mana Hub: Einmalig freigeben, Immer erlauben oder Ablehnen.',
  ].join('\n')

  const result = await supabase.from('agent_messages').insert({
    agent_name: approval.agent_name,
    role: 'system',
    content,
    reply_to_id: replyToId,
    metadata: {
      kind: 'risk_approval_request',
      approval_id: approval.id,
      action_type: approval.action_type,
    },
  })
  if (result.error?.message?.includes('metadata')) {
    await supabase.from('agent_messages').insert({
      agent_name: approval.agent_name,
      role: 'system',
      content,
      reply_to_id: replyToId,
    })
  } else if (result.error) {
    console.error('[approvals] request notice insert error:', result.error.message)
  }
}

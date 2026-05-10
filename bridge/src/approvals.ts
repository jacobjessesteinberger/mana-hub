/**
 * Bridge-side helpers for the Risk-Approval pipeline.
 *
 * When an agent writes an outbox reply with `type: approval_request` in its
 * YAML frontmatter, dispatchOutboxReply() (file-drop.ts) calls
 * insertApprovalFromMarker() instead of the normal agent_messages insert.
 *
 * Mirrors the logic in src/lib/agents/approvals.ts (server-side). Kept here
 * as a small duplicate because the bridge is a separate Node process with its
 * own tsconfig — cross-package imports would require build orchestration we
 * don't have set up.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyDashboard } from './push.ts'

type Frontmatter = Record<string, string>

const RISK_TERMS = /critical|kritisch|finance|geld|zahlung|rechnung|legal|vertrag|publish|veröffentlichen|posten|delete|löschen|security|credential|token|oauth|extern|kunde|client|api key|automation|config|bank|konto/i

function inferRiskLevel(actionType: string, payloadJson: string): string {
  const text = `${actionType}\n${payloadJson}`
  if (/delete|löschen|token|credential|api key|security|legal|vertrag|payment|zahlung|kunde|client|bank|konto/i.test(text)) {
    return 'critical'
  }
  if (RISK_TERMS.test(text)) return 'high'
  return 'medium'
}

function inferSummary(actionType: string, fm: Frontmatter, body: string): string {
  if (fm.action_summary) return fm.action_summary.slice(0, 240)
  const firstLine = body.split('\n').map(l => l.trim()).find(Boolean)
  if (firstLine && firstLine.length <= 240) return firstLine
  return actionType.replace(/[._-]/g, ' ').slice(0, 240)
}

function parsePayload(fm: Frontmatter): Record<string, unknown> {
  if (!fm.action_payload) return {}
  try {
    const parsed = JSON.parse(fm.action_payload)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    return { value: parsed }
  } catch {
    return { raw: fm.action_payload }
  }
}

interface PolicyRow {
  id: string
  name: string
  agent_name: string | null
  use_count: number | null
}

async function findMatchingAlwaysPolicy(
  supabase: SupabaseClient,
  agentName: string,
  actionType: string
): Promise<PolicyRow | null> {
  const { data, error } = await supabase
    .from('approval_policies')
    .select('id, name, agent_name, use_count')
    .eq('trigger_type', 'action_type')
    .eq('trigger_value', actionType)
    .eq('enabled', true)
    .or(`agent_name.eq.${agentName},agent_name.is.null`)
  if (error) {
    console.warn('[bridge-approvals] policy lookup error:', error.message)
    return null
  }
  if (!data || data.length === 0) return null
  return (data.find(r => r.agent_name === agentName) || data[0]) as PolicyRow
}

function buildDecisionMessage(opts: {
  approvalId: string
  agentName: string
  actionType: string
  actionSummary: string | null
  riskLevel: string
  status: 'approved' | 'rejected'
  reason?: string | null
  policyName?: string | null
}): string {
  const title = opts.status === 'approved' ? 'Risk Approval genehmigt' : 'Risk Approval abgelehnt'
  const instruction = opts.status === 'approved'
    ? 'Du darfst die beantragte Aktion jetzt ausfuehren. Nutze exakt den genehmigten Scope und dokumentiere das Ergebnis.'
    : 'Fuehre diese Aktion nicht aus. Beruecksichtige die Begruendung und schlage bei Bedarf eine risikoaermere Alternative vor.'
  const lines = [
    `${title}: ${opts.actionSummary || opts.actionType}`,
    `Approval-ID: ${opts.approvalId}`,
    `Action-Type: ${opts.actionType}`,
    `Risiko-Level: ${opts.riskLevel}`,
  ]
  if (opts.policyName) lines.push(`Auto-genehmigt durch Policy: ${opts.policyName}`)
  if (opts.reason) lines.push('Begruendung:', opts.reason)
  else lines.push('Keine zusaetzliche Begruendung hinterlegt.')
  lines.push('', instruction)
  return lines.join('\n')
}

export interface ApprovalMarkerResult {
  approvalId: string | null
  status: 'pending' | 'approved'
  autoApprovedBy: string | null
  error?: string
}

/**
 * Insert an approval row when the agent's outbox reply is marked as a
 * `type: approval_request`. Honours always-policies (auto-approve + immediate
 * decision message). Always writes a `risk_approval_request` system row into
 * agent_messages so the chat thread shows what happened.
 */
export async function insertApprovalFromMarker(
  supabase: SupabaseClient,
  agentName: string,
  fm: Frontmatter,
  body: string,
  replyToId: string | null
): Promise<ApprovalMarkerResult> {
  const actionType = fm.action_type?.trim()
  if (!actionType) {
    return { approvalId: null, status: 'pending', autoApprovedBy: null, error: 'missing action_type' }
  }

  const payload = parsePayload(fm)
  const riskLevel = (fm.risk_level || inferRiskLevel(actionType, JSON.stringify(payload))).toLowerCase()
  const actionSummary = inferSummary(actionType, fm, body)
  const riskReason = fm.risk_reason?.slice(0, 5000) || body.slice(0, 5000) || null

  const matchingPolicy = await findMatchingAlwaysPolicy(supabase, agentName, actionType)

  const baseRow: Record<string, unknown> = {
    agent_name: agentName,
    action_type: actionType,
    action_payload: payload,
    risk_level: riskLevel,
    action_summary: actionSummary,
    risk_reason: riskReason,
  }

  const row = matchingPolicy
    ? {
        ...baseRow,
        status: 'approved',
        execution_status: 'approved_for_execution',
        auto_approved_by_policy_id: matchingPolicy.id,
        decided_by: `policy:${matchingPolicy.id}`,
        decided_at: new Date().toISOString(),
      }
    : { ...baseRow, execution_status: 'waiting_approval' }

  const { data: inserted, error } = await supabase
    .from('approvals')
    .insert(row)
    .select('id, agent_name, action_type, action_summary, risk_level, related_issue_id')
    .single()

  if (error || !inserted) {
    const fallback = await supabase
      .from('approvals')
      .insert({ agent_name: agentName, action_type: actionType, action_payload: payload })
      .select('id, agent_name, action_type, action_summary, risk_level, related_issue_id')
      .single()
    if (fallback.error) {
      console.error('[bridge-approvals] failed to insert approval:', fallback.error.message)
      return { approvalId: null, status: 'pending', autoApprovedBy: null, error: fallback.error.message }
    }
    Object.assign(inserted ?? {}, fallback.data)
  }

  const approvalId = inserted!.id

  const noticeContent = [
    `Risk Approval angefragt: ${actionSummary}`,
    `Approval-ID: ${approvalId}`,
    `Action-Type: ${actionType}`,
    `Risiko-Level: ${riskLevel}`,
    '',
    matchingPolicy
      ? `Auto-genehmigt durch Policy "${matchingPolicy.name}" (${matchingPolicy.id}).`
      : 'Entscheide dich im Risk-Approval-Tab im Mana Hub: Einmalig freigeben, Immer erlauben oder Ablehnen.',
  ].join('\n')

  await supabase.from('agent_messages').insert({
    agent_name: agentName,
    role: 'system',
    content: noticeContent,
    reply_to_id: replyToId,
    metadata: {
      kind: 'risk_approval_request',
      approval_id: approvalId,
      action_type: actionType,
      auto_approved: !!matchingPolicy,
    },
  }).then(result => {
    if (result.error?.message?.includes('metadata')) {
      return supabase.from('agent_messages').insert({
        agent_name: agentName,
        role: 'system',
        content: noticeContent,
        reply_to_id: replyToId,
      })
    }
  })

  if (matchingPolicy) {
    const decisionContent = buildDecisionMessage({
      approvalId,
      agentName,
      actionType,
      actionSummary,
      riskLevel,
      status: 'approved',
      policyName: matchingPolicy.name,
    })
    await Promise.all([
      supabase.from('agent_messages').insert({
        agent_name: agentName,
        role: 'user',
        content: decisionContent,
        metadata: {
          kind: 'risk_approval_decision',
          approval_id: approvalId,
          decision: 'approved',
          action_type: actionType,
          action_summary: actionSummary,
          auto_approved: true,
          policy_name: matchingPolicy.name,
        },
      }).then(result => {
        if (result.error?.message?.includes('metadata')) {
          return supabase.from('agent_messages').insert({
            agent_name: agentName,
            role: 'user',
            content: decisionContent,
          })
        }
      }),
      supabase
        .from('approval_policies')
        .update({
          use_count: (matchingPolicy.use_count ?? 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', matchingPolicy.id),
      supabase
        .from('approvals')
        .update({ feedback_sent_at: new Date().toISOString() })
        .eq('id', approvalId),
    ])
  }

  if (!matchingPolicy) {
    void notifyDashboard({
      title: `Risk Approval: ${agentName}`,
      body: actionSummary || actionType,
      url: '/dashboard/agents/approvals',
      tag: `approval-${approvalId}`,
    })
  }

  return {
    approvalId,
    status: matchingPolicy ? 'approved' : 'pending',
    autoApprovedBy: matchingPolicy ? matchingPolicy.id : null,
  }
}

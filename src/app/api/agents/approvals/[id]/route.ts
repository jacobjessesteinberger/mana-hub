import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { insertDecisionMessage, type ApprovalRecord } from '@/lib/agents/approvals'

const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const body = await request.json()
  const { status, reason, policy: policyMode } = body as {
    status?: string
    reason?: string
    policy?: string
  }

  if (!status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 })
  }
  const decisionStatus = status as 'approved' | 'rejected'

  const wantsAlways = policyMode === 'always'
  if (wantsAlways && decisionStatus !== 'approved') {
    return NextResponse.json({ error: 'policy=always is only valid with status=approved' }, { status: 400 })
  }

  if (isDemoMode) {
    return NextResponse.json({
      approval: {
        id,
        agent_name: 'builder',
        action_type: 'automation.config.update',
        action_payload: {
          summary: 'Change a demo automation schedule from daily to weekdays',
          target: 'demo-morning-briefing',
        },
        action_summary: 'Demo: update a scheduled automation trigger',
        risk_level: 'high',
        related_issue_id: null,
        status: decisionStatus,
        reason: reason ? escapeHtml(String(reason).slice(0, 5000)) : null,
        decided_at: new Date().toISOString(),
        decided_by: auth.email || auth.id,
        execution_status: decisionStatus === 'approved' ? 'approved_for_execution' : 'rejected',
      },
      policy_created: wantsAlways ? { id: 'demo-policy-1', name: 'Demo: automation.config.update' } : null,
    })
  }

  const supabase = createServerSupabase()
  const safeReason = reason ? escapeHtml(String(reason).slice(0, 5000)) : null
  const now = new Date().toISOString()

  const updateRow = {
    status: decisionStatus,
    reason: safeReason,
    decided_at: now,
    decided_by: auth.email || auth.id,
    execution_status: decisionStatus === 'approved' ? 'approved_for_execution' : 'rejected',
  }

  const { data: updatedData, error } = await supabase
    .from('approvals')
    .update(updateRow)
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single()
  let data = updatedData as (ApprovalRecord & Record<string, unknown>) | null

  if (error) {
    const fallback = await supabase
      .from('approvals')
      .update({
        status: decisionStatus,
        reason: safeReason,
        decided_at: now,
        decided_by: auth.email || auth.id,
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single()

    if (fallback.error) {
      console.error('Approval update error:', fallback.error.message)
      return NextResponse.json({ error: 'Failed to update pending approval' }, { status: 500 })
    }
    data = fallback.data as ApprovalRecord & Record<string, unknown>
  }

  if (!data) {
    return NextResponse.json({ error: 'Approval not found or already decided' }, { status: 404 })
  }

  const approval = data
  const decidedBy = auth.email || auth.id

  let createdPolicy: { id: string; name: string } | null = null
  if (wantsAlways) {
    const policyName = `Always: ${approval.action_type}`
    const { data: policyData, error: policyError } = await supabase
      .from('approval_policies')
      .insert({
        name: policyName,
        description: `Auto-created when ${decidedBy} clicked "Immer erlauben" on approval ${approval.id}.`,
        trigger_type: 'action_type',
        trigger_value: approval.action_type,
        agent_name: approval.agent_name,
        source: 'manual',
        decided_by: decidedBy,
        enabled: true,
      })
      .select('id, name')
      .single()
    if (policyError) {
      console.error('[approvals] failed to create always-policy:', policyError.message)
    } else if (policyData) {
      createdPolicy = { id: policyData.id, name: policyData.name }
      await supabase
        .from('approvals')
        .update({ auto_approved_by_policy_id: policyData.id })
        .eq('id', approval.id)
    }
  }

  await Promise.all([
    insertDecisionMessage(supabase, approval, decisionStatus, safeReason),
    approval.related_issue_id
      ? supabase.from('issue_comments').insert({
          issue_id: approval.related_issue_id,
          author: 'risk-approval',
          content: `Approval ${approval.id} ${decisionStatus} by ${decidedBy}${safeReason ? `: ${safeReason}` : ''}`,
        })
      : Promise.resolve(),
  ])

  await supabase
    .from('approvals')
    .update({ feedback_sent_at: new Date().toISOString() })
    .eq('id', approval.id)

  return NextResponse.json({ approval, policy_created: createdPolicy })
}

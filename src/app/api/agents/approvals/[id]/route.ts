import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

type ApprovalDecision = {
  id: string
  agent_name: string
  action_type: string
  action_payload?: Record<string, unknown> | null
  action_summary?: string | null
  risk_level?: string | null
  related_issue_id?: string | null
}

function decisionMessage(approval: ApprovalDecision, status: 'approved' | 'rejected', reason?: string) {
  const title = status === 'approved' ? 'Risk Approval genehmigt' : 'Risk Approval abgelehnt'
  const instruction = status === 'approved'
    ? 'Du darfst die beantragte Aktion jetzt ausführen. Nutze exakt den genehmigten Scope und dokumentiere das Ergebnis.'
    : 'Führe diese Aktion nicht aus. Berücksichtige die Begründung und schlage bei Bedarf eine risikoärmere Alternative vor.'

  return [
    `${title}: ${approval.action_summary || approval.action_type}`,
    `Risiko-Level: ${approval.risk_level || 'high'}`,
    reason ? `Begründung:\n${reason}` : 'Keine zusätzliche Begründung hinterlegt.',
    '',
    instruction,
  ].join('\n')
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params
  const body = await request.json()
  const { status, reason } = body

  if (!status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 })
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
        status,
        reason: reason ? escapeHtml(String(reason).slice(0, 5000)) : null,
        decided_at: new Date().toISOString(),
        decided_by: auth.email || auth.id,
        execution_status: status === 'approved' ? 'approved_for_execution' : 'rejected',
      },
    })
  }

  const supabase = createServerSupabase()
  const safeReason = reason ? escapeHtml(String(reason).slice(0, 5000)) : null
  const now = new Date().toISOString()

  const updateRow = {
    status,
    reason: safeReason,
    decided_at: now,
    decided_by: auth.email || auth.id,
    execution_status: status === 'approved' ? 'approved_for_execution' : 'rejected',
  }

  const { data: updatedData, error } = await supabase
    .from('approvals')
    .update(updateRow)
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single()
  let data = updatedData as ApprovalDecision | null

  if (error) {
    const fallback = await supabase
      .from('approvals')
      .update({
        status,
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
    data = fallback.data as ApprovalDecision
  }

  if (!data) {
    return NextResponse.json({ error: 'Approval not found or already decided' }, { status: 404 })
  }

  const approval = data
  const content = decisionMessage(approval, status, safeReason || undefined)
  await Promise.all([
    supabase.from('agent_messages').insert({
      agent_name: approval.agent_name,
      role: 'user',
      content,
      metadata: {
        kind: 'risk_approval_decision',
        approval_id: approval.id,
        decision: status,
        action_type: approval.action_type,
      },
    }).then(async result => {
      if (result.error?.message.includes('metadata')) {
        await supabase.from('agent_messages').insert({
          agent_name: approval.agent_name,
          role: 'user',
          content,
        })
      }
    }),
    approval.related_issue_id
      ? supabase.from('issue_comments').insert({
        issue_id: approval.related_issue_id,
        author: 'risk-approval',
        content,
      })
      : Promise.resolve(),
  ])

  await supabase
    .from('approvals')
    .update({ feedback_sent_at: new Date().toISOString() })
    .eq('id', approval.id)

  return NextResponse.json({ approval })
}

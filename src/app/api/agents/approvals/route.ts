import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import {
  findMatchingAlwaysPolicy,
  recordPolicyUse,
  insertDecisionMessage,
  type ApprovalRecord,
} from '@/lib/agents/approvals'
import { sendPushToAdminSafe } from '@/lib/push/server'

const RISK_TERMS = /critical|kritisch|finance|geld|zahlung|rechnung|legal|vertrag|publish|veröffentlichen|posten|delete|löschen|security|credential|token|oauth|extern|kunde|client|api key|automation|config/i
const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

function inferRiskLevel(actionType: string, payload: Record<string, unknown>) {
  const text = `${actionType}\n${JSON.stringify(payload)}`
  if (/delete|löschen|token|credential|api key|security|legal|vertrag|payment|zahlung|kunde|client/i.test(text)) return 'critical'
  if (RISK_TERMS.test(text)) return 'high'
  return 'medium'
}

function inferSummary(actionType: string, payload: Record<string, unknown>) {
  const explicit = payload.summary || payload.title || payload.name || payload.description
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim().slice(0, 240)
  return actionType.replace(/[._-]/g, ' ').slice(0, 240)
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  if (isDemoMode) {
    return NextResponse.json({
      approvals: [
        {
          id: 'demo-approval-1',
          agent_name: 'builder',
          action_type: 'automation.config.update',
          action_payload: {
            summary: 'Change a demo automation schedule from daily to weekdays',
            target: 'demo-morning-briefing',
            requested_change: 'weekday_schedule',
          },
          action_summary: 'Demo: update a scheduled automation trigger',
          risk_level: 'high',
          risk_reason: 'This demo approval shows how risky automation changes are reviewed before execution.',
          status: 'pending',
          execution_status: 'waiting_approval',
          expires_at: null,
          feedback_sent_at: null,
          requested_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
          created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
          decided_at: null,
          decided_by: null,
          reason: null,
          related_issue_id: null,
          policy: {
            name: 'Automation Safety Review',
            description: 'Demo policy for reviewing risky automation changes.',
            trigger_type: 'risk_level',
          },
        },
      ],
    })
  }

  const supabase = createServerSupabase()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const agent = searchParams.get('agent')

  let query = supabase
    .from('approvals')
    .select('*, policy:approval_policies!policy_id(*)')
    .order('requested_at', { ascending: false })
    .limit(50)

  if (status) query = query.eq('status', status)
  if (agent) query = query.eq('agent_name', agent)

  const { data, error } = await query

  if (error) {
    console.error('Approvals fetch error:', error.message)
    return NextResponse.json({ approvals: [], error: 'Failed to fetch approvals' }, { status: 500 })
  }

  return NextResponse.json({ approvals: data || [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const body = await request.json()
  const {
    agent_name,
    action_type,
    action_payload,
    policy_id,
    related_issue_id,
    risk_level,
    action_summary,
    risk_reason,
    expires_at,
  } = body

  if (!agent_name || !action_type) {
    return NextResponse.json({ error: 'agent_name and action_type required' }, { status: 400 })
  }

  const payload = (action_payload && typeof action_payload === 'object' && !Array.isArray(action_payload))
    ? action_payload as Record<string, unknown>
    : {}

  const supabase = createServerSupabase()

  const matchingPolicy = await findMatchingAlwaysPolicy(supabase, String(agent_name), String(action_type))

  const baseRow = {
    agent_name,
    action_type,
    action_payload: payload,
    policy_id: policy_id || null,
    related_issue_id: related_issue_id || null,
    risk_level: risk_level || inferRiskLevel(action_type, payload),
    action_summary: action_summary ? escapeHtml(String(action_summary)) : escapeHtml(inferSummary(action_type, payload)),
    risk_reason: risk_reason ? escapeHtml(String(risk_reason)) : null,
    expires_at: expires_at || null,
  }

  const row = matchingPolicy
    ? {
        ...baseRow,
        status: 'approved' as const,
        execution_status: 'approved_for_execution' as const,
        auto_approved_by_policy_id: matchingPolicy.id,
        decided_by: `policy:${matchingPolicy.id}`,
        decided_at: new Date().toISOString(),
      }
    : { ...baseRow, execution_status: 'waiting_approval' as const }

  const { data: insertedData, error } = await supabase
    .from('approvals')
    .insert(row)
    .select()
    .single()
  let data = insertedData

  if (error) {
    const fallback = await supabase
      .from('approvals')
      .insert({
        agent_name,
        action_type,
        action_payload: payload,
        policy_id: policy_id || null,
        related_issue_id: related_issue_id || null,
      })
      .select()
      .single()

    if (fallback.error) {
      console.error('Approval create error:', fallback.error.message)
      return NextResponse.json({ error: 'Failed to create approval' }, { status: 500 })
    }
    data = fallback.data
  }

  if (matchingPolicy && data) {
    const approval: ApprovalRecord = {
      id: data.id,
      agent_name: data.agent_name,
      action_type: data.action_type,
      action_payload: data.action_payload,
      action_summary: data.action_summary,
      risk_level: data.risk_level,
      related_issue_id: data.related_issue_id,
    }
    await Promise.all([
      insertDecisionMessage(supabase, approval, 'approved', null, { policyName: matchingPolicy.name }),
      recordPolicyUse(supabase, matchingPolicy.id, matchingPolicy.use_count),
      supabase
        .from('approvals')
        .update({ feedback_sent_at: new Date().toISOString() })
        .eq('id', data.id),
    ])
  } else if (data) {
    sendPushToAdminSafe({
      title: `Risk Approval: ${data.agent_name}`,
      body: data.action_summary || data.action_type,
      url: '/dashboard/agents/approvals',
      tag: `approval-${data.id}`,
    })
  }

  return NextResponse.json({
    approval: data,
    auto_approved: !!matchingPolicy,
    policy: matchingPolicy ? { id: matchingPolicy.id, name: matchingPolicy.name } : null,
  }, { status: 201 })
}

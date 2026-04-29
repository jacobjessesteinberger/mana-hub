import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse, escapeHtml } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { buildWorkspaceContext } from '@/lib/agents/workspace-context'
import { AGENT_MAP } from '@/lib/agents-meta'

const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const { id } = await params

  let input: Record<string, unknown> = {}
  try {
    input = await request.json()
  } catch {
    input = {}
  }

  if (isDemoMode && id === 'demo-workspace-1') {
    const requestedAgent = typeof input.agent_name === 'string' ? input.agent_name : null
    const agentName = requestedAgent && AGENT_MAP[requestedAgent] ? requestedAgent : 'orchestrator'
    return NextResponse.json({
      ok: true,
      agent_name: agentName,
      message: {
        id: 'demo-workspace-review-message',
        agent_name: agentName,
        role: 'user',
        content: 'Demo Workspace Review gestartet.',
        created_at: new Date().toISOString(),
      },
      context: {
        workspace_id: id,
        workspace_name: 'Starter Setup Workspace',
        metrics: { reviewStatus: 'needs_attention' },
        participating_agents: ['orchestrator', 'researcher', 'builder'],
      },
      chat_url: `/dashboard/agents/${agentName}/chat?workspace=${id}`,
    }, { status: 201 })
  }

  let context
  try {
    context = await buildWorkspaceContext(id)
  } catch {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const requestedAgent = typeof input.agent_name === 'string' ? input.agent_name : null
  const agentName = requestedAgent && AGENT_MAP[requestedAgent]
    ? requestedAgent
    : context.ownerAgent && AGENT_MAP[context.ownerAgent]
      ? context.ownerAgent
      : context.participatingAgents.find(agent => AGENT_MAP[agent])

  if (!agentName) {
    return NextResponse.json({
      error: 'Workspace has no valid owner_agent or participating agent',
      hint: 'Set an Owner-Agent on the workspace before starting an agent review.',
    }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('agent_messages')
    .insert({
      agent_name: agentName,
      role: 'user',
      content: escapeHtml(context.prompt),
      metadata: {
        source: 'workspace_review',
        workspace_id: context.project.id,
        workspace_name: context.project.name,
        review_status: context.metrics.reviewStatus,
        generated_by: 'mana_hub_core',
      },
    })
    .select()
    .single()

  if (error) {
    console.error('Workspace review message create error:', error.message)
    return NextResponse.json({ error: 'Failed to create workspace review message' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    agent_name: agentName,
    message: data,
    context: {
      workspace_id: context.project.id,
      workspace_name: context.project.name,
      metrics: context.metrics,
      participating_agents: context.participatingAgents,
    },
    chat_url: `/dashboard/agents/${agentName}/chat?workspace=${context.project.id}`,
  }, { status: 201 })
}

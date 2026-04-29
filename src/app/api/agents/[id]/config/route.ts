import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { isValidAgentName, AGENT_MAP } from '@/lib/agents-meta'
import { createServerSupabase } from '@/lib/supabase'
import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const name = (await params).id
  if (!isValidAgentName(name)) {
    return NextResponse.json({ error: 'Invalid agent name' }, { status: 400 })
  }

  const meta = AGENT_MAP[name]
  const supabase = createServerSupabase()

  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('agent_name', name)
    .single()

  let claudeConfig: Record<string, unknown> = {}
  try {
    const raw = await readFile(join(homedir(), '.claude.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    const projects = parsed.projects || {}
    const agentKey = Object.keys(projects).find(k => k.toLowerCase().includes(name))
    if (agentKey) {
      claudeConfig = projects[agentKey]
    }
    claudeConfig._allowedTools = parsed.allowedTools || []
  } catch { /* file may not exist */ }

  return NextResponse.json({
    agent: name,
    identity: {
      name: profile?.agent_name || name,
      title: profile?.title || meta?.role || 'Agent',
      reports_to: profile?.parent_agent || null,
      capabilities: profile?.job_description || '',
      department: profile?.department || '',
    },
    adapter: {
      type: 'Claude Code (local)',
      command: 'claude',
      model: 'Default',
      thinking_effort: 'Auto',
    },
    permissions: {
      skip_permissions: true,
      max_turns_per_run: 1000,
      can_create_agents: name === 'orchestrator',
      can_assign_tasks: name === 'orchestrator',
    },
    run_policy: {
      heartbeat_on_interval: true,
      heartbeat_interval: '15s',
    },
    raw_claude_config: claudeConfig,
    profile,
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  const name = (await params).id
  if (!isValidAgentName(name)) {
    return NextResponse.json({ error: 'Invalid agent name' }, { status: 400 })
  }

  const body = await request.json()
  const { title, job_description, department, parent_agent } = body

  const supabase = createServerSupabase()
  const updates: Record<string, unknown> = {}
  if (title !== undefined) updates.title = title
  if (job_description !== undefined) updates.job_description = job_description
  if (department !== undefined) updates.department = department
  if (parent_agent !== undefined) updates.parent_agent = parent_agent

  const { data, error } = await supabase
    .from('agent_profiles')
    .update(updates)
    .eq('agent_name', name)
    .select()
    .single()

  if (error) {
    console.error('Agent config update error:', error.message)
    return NextResponse.json({ error: 'Failed to update agent config' }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}

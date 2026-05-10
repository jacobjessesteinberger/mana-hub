import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'
import { AGENT_NAMES } from '@/lib/agents-meta'
import { execFileSync } from 'child_process'

const TMUX_BIN = process.env.TMUX_BIN || 'tmux'
const SESSION_NAME_RE = /^[a-zA-Z0-9_-]+$/

const ACTION_KEYS: Record<string, string> = {
  allow_once: '1',
  allow_always: '2',
  deny: '3',
}

function isTmuxSessionAlive(session: string): boolean {
  if (!SESSION_NAME_RE.test(session)) return false
  try {
    execFileSync(TMUX_BIN, ['has-session', '-t', session], { stdio: 'ignore' })
    return true
  } catch { return false }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (isAuthResponse(auth)) return auth

  let body: { agent_name?: string; action?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { agent_name, action } = body
  if (!agent_name || !AGENT_NAMES.has(agent_name)) {
    return NextResponse.json({ error: 'Invalid agent_name' }, { status: 400 })
  }
  if (!action || !ACTION_KEYS[action]) {
    return NextResponse.json({ error: 'Invalid action — use allow_once, allow_always, or deny' }, { status: 400 })
  }

  if (!isTmuxSessionAlive(agent_name)) {
    return NextResponse.json({ error: `tmux session "${agent_name}" not found` }, { status: 503 })
  }

  try {
    const key = ACTION_KEYS[action]
    execFileSync(TMUX_BIN, ['send-keys', '-t', agent_name, key], { timeout: 3000 })
    execFileSync(TMUX_BIN, ['send-keys', '-t', agent_name, 'Enter'], { timeout: 3000 })
  } catch {
    return NextResponse.json({ error: 'Failed to send keys to tmux' }, { status: 500 })
  }

  const supabase = createServerSupabase()
  await supabase
    .from('agent_activity')
    .update({ permission_pending: false, permission_prompt: null })
    .eq('agent_name', agent_name)

  return NextResponse.json({
    ok: true,
    message: `Permission ${action} an ${agent_name.toUpperCase()} gesendet`,
  })
}

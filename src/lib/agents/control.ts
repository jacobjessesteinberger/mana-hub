import { execFileSync } from 'child_process'
import { createServerSupabase } from '@/lib/supabase'
import { AGENT_NAMES } from '@/lib/agents-meta'

const TMUX_BIN = process.env.MANA_HUB_TMUX_BIN || 'tmux'
const SESSION_NAME_RE = /^[a-zA-Z0-9_-]+$/

function isTmuxEnabled() {
  return process.env.MANA_HUB_RUNNER === 'tmux'
}

function isTmuxSessionAlive(session: string): boolean {
  if (!isTmuxEnabled() || !SESSION_NAME_RE.test(session)) return false
  try {
    execFileSync(TMUX_BIN, ['has-session', '-t', session], { stdio: 'ignore', timeout: 3000 })
    return true
  } catch {
    return false
  }
}

function interruptTmuxSession(agentName: string): boolean {
  if (!isTmuxSessionAlive(agentName)) return false
  try {
    execFileSync(TMUX_BIN, ['send-keys', '-t', agentName, 'C-c'], { timeout: 3000 })
    return true
  } catch {
    return false
  }
}

export async function stopAgentWork(agentName: string, reason: string, sourceMessageId?: string) {
  if (!AGENT_NAMES.has(agentName)) {
    return { ok: false, interrupted: false, error: 'Invalid agent_name' }
  }

  const now = new Date().toISOString()
  const interrupted = interruptTmuxSession(agentName)
  const supabase = createServerSupabase()

  await Promise.allSettled([
    supabase
      .from('agent_activity')
      .update({
        active: false,
        status: 'stopped',
        current_task: null,
        event_summary: `Stopped: ${reason}`,
        permission_pending: false,
        permission_prompt: null,
        updated_at: now,
      })
      .eq('agent_name', agentName),
    supabase
      .from('issue_runs')
      .update({ status: 'stopped', updated_at: now, output: `Stopped by user: ${reason}` })
      .eq('agent_name', agentName)
      .eq('status', 'running'),
    supabase
      .from('agent_messages')
      .insert({
        agent_name: agentName,
        role: 'system',
        content: `Stop requested: ${reason}`,
        metadata: {
          kind: 'agent_control',
          command: 'stop',
          source_message_id: sourceMessageId || null,
          stopped_at: now,
          interrupted,
        },
      }),
  ])

  return { ok: true, interrupted }
}

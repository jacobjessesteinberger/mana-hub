import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { AgentMessage, BridgeConfig } from './types.ts'
import { decide } from './lifecycle.ts'
import { setProcessing, setIdle } from './activity.ts'
import { registerWork, clearWork, abortWork, AbortError } from './stop.ts'
import { handleUserMessage } from './handler.ts'
import {
  writeInboxMessage,
  notifyTmuxSession,
  watchOutbox,
  dispatchOutboxReply,
  ensureAgentDir,
  type OutboxWatcher,
} from './file-drop.ts'
import { getAttachments } from './types.ts'

const TABLE = 'agent_messages'

const seenIds = new Set<string>()
const lastSeenByAgent = new Map<string, string>()

function rememberMessage(msg: AgentMessage): boolean {
  if (seenIds.has(msg.id)) return false
  seenIds.add(msg.id)
  if (seenIds.size > 5000) {
    const first = seenIds.values().next().value
    if (first) seenIds.delete(first)
  }
  const prev = lastSeenByAgent.get(msg.agent_name)
  if (!prev || msg.created_at > prev) {
    lastSeenByAgent.set(msg.agent_name, msg.created_at)
  }
  return true
}

async function writeAssistantReply(
  supabase: SupabaseClient,
  agentName: string,
  content: string,
  replyToId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from(TABLE).insert({
    agent_name: agentName,
    role: 'assistant',
    content,
    reply_to_id: replyToId,
    metadata,
  })
  if (error) {
    console.error(`[connector] failed to write assistant reply for ${agentName}:`, error.message)
  }
}

async function writeStoppedSystemMessage(
  supabase: SupabaseClient,
  agentName: string,
  reason: string,
  inputMessageId: string
): Promise<void> {
  const { error } = await supabase.from(TABLE).insert({
    agent_name: agentName,
    role: 'system',
    content: `Bridge stopped work: ${reason}`,
    metadata: {
      kind: 'agent_control',
      command: 'stopped',
      input_message_id: inputMessageId,
      stopped_at: new Date().toISOString(),
    },
  })
  if (error) {
    console.error(`[connector] failed to write stopped system msg for ${agentName}:`, error.message)
  }
}

async function dispatchInline(
  supabase: SupabaseClient,
  cfg: BridgeConfig,
  msg: AgentMessage
): Promise<void> {
  const taskPreview = msg.content.slice(0, 80)
  await setProcessing(supabase, msg.agent_name, taskPreview)
  const signal = registerWork(msg.agent_name)

  try {
    const result = await handleUserMessage(msg, cfg.echoPrefix, signal)
    await writeAssistantReply(supabase, msg.agent_name, result.content, msg.id, result.metadata)
    await setIdle(supabase, msg.agent_name, 'idle', `Replied to message ${msg.id}`)
  } catch (err) {
    if (err instanceof AbortError) {
      console.log(`[connector] aborted work for ${msg.agent_name}: ${err.message}`)
      await writeStoppedSystemMessage(supabase, msg.agent_name, err.message, msg.id)
      await setIdle(supabase, msg.agent_name, 'stopped', `Stopped while replying to ${msg.id}`)
    } else {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[connector] handler error for ${msg.agent_name}:`, errMsg)
      await setIdle(supabase, msg.agent_name, 'error', `Handler error: ${errMsg}`)
    }
  } finally {
    clearWork(msg.agent_name)
  }
}

async function dispatchFileDrop(
  supabase: SupabaseClient,
  cfg: BridgeConfig,
  msg: AgentMessage
): Promise<void> {
  const attachments = getAttachments(msg)
  await setProcessing(supabase, msg.agent_name, msg.content.slice(0, 80))

  try {
    const filePath = await writeInboxMessage({
      agentsDir: cfg.agentsDir,
      agentName: msg.agent_name,
      msg,
      attachments,
    })
    console.log(`[connector] file_drop wrote ${filePath}`)

    if (cfg.tmuxEnabled) {
      const notified = await notifyTmuxSession(msg.agent_name)
      if (notified) {
        console.log(`[connector] notified tmux session ${msg.agent_name}`)
      } else {
        console.warn(`[connector] tmux session ${msg.agent_name} not found, agent must poll inbox itself`)
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[connector] file_drop write error for ${msg.agent_name}:`, errMsg)
    await setIdle(supabase, msg.agent_name, 'error', `file_drop write failed: ${errMsg}`)
  }
}

async function dispatchMessage(
  supabase: SupabaseClient,
  cfg: BridgeConfig,
  msg: AgentMessage
): Promise<void> {
  const decision = decide(msg)

  if (decision.kind === 'stop') {
    const aborted = abortWork(msg.agent_name, decision.reason)
    console.log(`[connector] stop signal for ${msg.agent_name}: ${decision.reason}` + (aborted ? ' (aborted live work)' : ' (no live work)'))
    return
  }

  if (decision.kind === 'skip') {
    console.log(`[connector] skip ${msg.id} for ${msg.agent_name}: ${decision.reason}`)
    return
  }

  const taskPreview = msg.content.slice(0, 80)
  console.log(`[connector] processing ${msg.id} for ${msg.agent_name} (${cfg.mode}): "${taskPreview}"`)

  if (cfg.mode === 'file_drop') {
    await dispatchFileDrop(supabase, cfg, msg)
  } else {
    await dispatchInline(supabase, cfg, msg)
  }
}

async function pollOnce(supabase: SupabaseClient, cfg: BridgeConfig): Promise<void> {
  for (const agentName of cfg.agentNames) {
    const since = lastSeenByAgent.get(agentName) ?? new Date(Date.now() - 60_000).toISOString()
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('agent_name', agentName)
      .gt('created_at', since)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) {
      console.error(`[connector] poll error for ${agentName}:`, error.message)
      continue
    }

    for (const row of (data ?? []) as AgentMessage[]) {
      if (!rememberMessage(row)) continue
      await dispatchMessage(supabase, cfg, row)
    }
  }
}

export type ConnectorLoop = {
  stop: () => Promise<void>
}

export async function startConnector(
  supabase: SupabaseClient,
  cfg: BridgeConfig
): Promise<ConnectorLoop> {
  console.log(`[connector] starting for agents: ${cfg.agentNames.join(', ')} (mode: ${cfg.mode})`)

  const outboxWatchers: OutboxWatcher[] = []

  if (cfg.mode === 'file_drop') {
    for (const agentName of cfg.agentNames) {
      await ensureAgentDir(cfg.agentsDir, agentName)
      const watcher = await watchOutbox(cfg.agentsDir, agentName, async (name, reply) => {
        await dispatchOutboxReply(supabase, name, reply)
        await setIdle(supabase, name, 'idle', `File-drop reply for ${reply.replyToId ?? 'unknown'}`)
      })
      outboxWatchers.push(watcher)
    }
  }

  await pollOnce(supabase, cfg)

  const channels: RealtimeChannel[] = []
  for (const agentName of cfg.agentNames) {
    const channel = supabase
      .channel(`bridge-${agentName}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: TABLE, filter: `agent_name=eq.${agentName}` },
        async (payload) => {
          const msg = payload.new as AgentMessage
          if (!rememberMessage(msg)) return
          await dispatchMessage(supabase, cfg, msg)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[connector] realtime subscribed for ${agentName}`)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[connector] realtime status for ${agentName}: ${status}`)
        }
      })
    channels.push(channel)
  }

  const pollHandle = setInterval(() => {
    void pollOnce(supabase, cfg)
  }, cfg.pollIntervalMs)

  return {
    stop: async () => {
      clearInterval(pollHandle)
      await Promise.allSettled(channels.map(c => supabase.removeChannel(c)))
      await Promise.allSettled(outboxWatchers.map(w => w.close()))
      console.log('[connector] stopped')
    },
  }
}

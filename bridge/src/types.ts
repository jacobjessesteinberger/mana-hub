export type AgentMessage = {
  id: string
  agent_name: string
  role: 'user' | 'assistant' | 'system' | string
  content: string
  reply_to_id: string | null
  ticket_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type LifecycleStatus = 'active' | 'edited' | 'superseded' | 'retracted'

export function getLifecycleStatus(msg: AgentMessage): LifecycleStatus {
  const status = msg.metadata?.lifecycle_status
  if (status === 'edited' || status === 'superseded' || status === 'retracted') {
    return status
  }
  return 'active'
}

export type Attachment = {
  name: string
  url: string
  type: string
  size: number
  storage_path?: string
}

export function getAttachments(msg: AgentMessage): Attachment[] {
  const raw = msg.metadata?.attachments
  if (!Array.isArray(raw)) return []
  return raw.filter((a): a is Attachment =>
    typeof a === 'object' && a !== null && typeof (a as Attachment).name === 'string'
  )
}

export type StopSignal = {
  agentName: string
  reason: string
  sourceMessageId: string | null
}

export function isStopSignal(msg: AgentMessage): StopSignal | null {
  if (msg.role !== 'system') return null
  const meta = msg.metadata
  if (!meta || meta.kind !== 'agent_control' || meta.command !== 'stop') return null
  return {
    agentName: msg.agent_name,
    reason: typeof meta.reason === 'string' ? meta.reason : 'Stop requested',
    sourceMessageId: typeof meta.source_message_id === 'string' ? meta.source_message_id : null,
  }
}

export type ProcessingState = 'idle' | 'processing' | 'stopped' | 'error'

export type BridgeMode = 'inline' | 'file_drop'

export type BridgeConfig = {
  supabaseUrl: string
  supabaseSecretKey: string
  agentNames: string[]
  pollIntervalMs: number
  echoPrefix: string
  heartbeatIntervalMs: number
  mode: BridgeMode
  agentsDir: string
  tmuxEnabled: boolean
  cronTickIntervalMs: number
}

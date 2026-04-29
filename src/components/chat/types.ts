import type { AgentMeta } from '@/lib/agents-meta'

export interface Attachment {
  id?: string
  name: string
  url: string
  type: string
  mime_type?: string
  kind?: string
  size: number
  storage_path?: string
  access?: 'public' | 'signed' | 'private'
  sha256?: string
  preview_url?: string
  local_path?: string
  extracted_text?: string
  extracted_text_status?: 'not_applicable' | 'pending' | 'ready' | 'failed'
}

export interface Message {
  id: string
  agent_name: string
  role: 'user' | 'assistant' | 'system'
  content: string
  ticket_id: string | null
  reply_to_id: string | null
  created_at: string
  metadata?: {
    attachments?: Attachment[]
    kind?: string
    source?: string
    job_id?: string
    job_name?: string
    title?: string
    priority?: 'low' | 'medium' | 'high' | 'critical'
    lifecycle_status?: 'active' | 'edited' | 'superseded' | 'retracted'
    edited_at?: string
    retracted_at?: string
    superseded_by?: string
    previous_message_id?: string
    edit_version?: number
    stop_requested_at?: string
  }
}

export type ChatAgentMeta = AgentMeta

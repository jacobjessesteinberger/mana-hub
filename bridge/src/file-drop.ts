import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import chokidar, { type FSWatcher } from 'chokidar'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentMessage, Attachment } from './types.ts'
import { insertApprovalFromMarker } from './approvals.ts'
import { insertCronRequestFromMarker } from './cron-requests.ts'

const TABLE = 'agent_messages'

function isoStamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-')
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36)
}

function agentDirFor(agentsDir: string, agentName: string): string {
  return path.join(agentsDir, agentName)
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true })
}

function escapeYaml(value: string): string {
  return value.replace(/'/g, "''")
}

export type InboxKind = 'user' | 'cron'

export type InboxWriteOptions = {
  agentsDir: string
  agentName: string
  msg: AgentMessage
  attachments?: Attachment[]
  kind?: InboxKind
}

export async function writeInboxMessage(opts: InboxWriteOptions): Promise<string> {
  const { agentsDir, agentName, msg, attachments = [], kind = 'user' } = opts
  const dir = path.join(agentDirFor(agentsDir, agentName), 'inbox')
  await ensureDir(dir)

  const prefix = kind === 'cron' ? 'cron' : 'msg'
  const fileName = `${prefix}-${isoStamp(new Date(msg.created_at))}-${safeId(msg.id)}.md`
  const filePath = path.join(dir, fileName)

  const lines: string[] = []
  lines.push('---')
  lines.push(`id: ${msg.id}`)
  lines.push(`agent_name: ${msg.agent_name}`)
  lines.push(`role: ${msg.role}`)
  lines.push(`created_at: ${msg.created_at}`)
  lines.push(`kind: ${kind}`)
  if (msg.reply_to_id) lines.push(`reply_to_id: ${msg.reply_to_id}`)
  if (msg.ticket_id) lines.push(`ticket_id: ${msg.ticket_id}`)

  // Lift selected metadata fields into YAML so the agent can copy them back
  // into its outbox reply (especially for cron-triggered briefings/reports
  // and for risk-approval decisions where the agent must match approval_id
  // back to its own pending state).
  const md = (msg.metadata ?? {}) as Record<string, unknown>
  const promoteFields: Array<keyof typeof md & string> = [
    'output_kind',
    'source',
    'job_id',
    'job_name',
    'briefing_title',
    'category',
    'urgency',
    'kind',
    'approval_id',
    'decision',
    'action_type',
    'action_summary',
    'auto_approved',
    'policy_name',
  ]
  for (const key of promoteFields) {
    const value = md[key]
    if (value === undefined || value === null) continue
    if (typeof value === 'string') {
      lines.push(`${key}: '${escapeYaml(value)}'`)
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${key}: ${value}`)
    }
  }

  if (attachments.length > 0) {
    lines.push('attachments:')
    for (const a of attachments) {
      lines.push(`  - name: '${escapeYaml(a.name)}'`)
      lines.push(`    type: '${escapeYaml(a.type)}'`)
      lines.push(`    size: ${a.size}`)
      lines.push(`    url: '${escapeYaml(a.url)}'`)
    }
  }
  lines.push('---')
  lines.push('')
  lines.push(msg.content)
  lines.push('')

  await fs.writeFile(filePath, lines.join('\n'), 'utf8')
  return filePath
}

export async function notifyTmuxSession(agentName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const check = spawn('tmux', ['has-session', '-t', agentName], { stdio: 'ignore' })
    check.on('exit', (code) => {
      if (code !== 0) {
        resolve(false)
        return
      }
      const send = spawn('tmux', ['send-keys', '-t', agentName, 'process_inbox', 'Enter'], {
        stdio: 'ignore',
      })
      send.on('exit', () => resolve(true))
      send.on('error', () => resolve(false))
    })
    check.on('error', () => resolve(false))
  })
}

export type ParsedReply = {
  replyToId: string | null
  createdAt: string | null
  body: string
  raw: Record<string, string>
}

function parseFrontMatter(text: string): ParsedReply {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (!match) {
    return { replyToId: null, createdAt: null, body: text.trim(), raw: {} }
  }
  const raw: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+?)\s*$/)
    if (m) raw[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return {
    replyToId: raw.reply_to_id || null,
    createdAt: raw.created_at || null,
    body: match[2].trim(),
    raw,
  }
}

export type OutboxReplyHandler = (
  agentName: string,
  reply: ParsedReply,
  filePath: string
) => Promise<void>

export type OutboxWatcher = {
  agentName: string
  close: () => Promise<void>
}

export async function watchOutbox(
  agentsDir: string,
  agentName: string,
  onReply: OutboxReplyHandler
): Promise<OutboxWatcher> {
  const dir = path.join(agentDirFor(agentsDir, agentName), 'outbox')
  await ensureDir(dir)
  await ensureDir(path.join(dir, 'processed'))

  const watcher: FSWatcher = chokidar.watch(dir, {
    depth: 0,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 50 },
    ignored: (p, stats) => {
      if (!stats) return false
      if (stats.isDirectory()) return path.basename(p) === 'processed'
      const base = path.basename(p)
      return !(base.startsWith('reply-') && base.endsWith('.md'))
    },
  })

  watcher.on('add', async (filePath: string) => {
    try {
      const text = await fs.readFile(filePath, 'utf8')
      const reply = parseFrontMatter(text)
      await onReply(agentName, reply, filePath)
      const dest = path.join(path.dirname(filePath), 'processed', path.basename(filePath))
      await fs.rename(filePath, dest).catch(() => {})
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[file-drop] failed to process ${filePath}:`, msg)
    }
  })

  watcher.on('error', (err) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[file-drop] watcher error for ${agentName}:`, msg)
  })

  console.log(`[file-drop] watching outbox for ${agentName}: ${dir}`)

  return {
    agentName,
    close: async () => {
      await watcher.close()
    },
  }
}

export async function dispatchOutboxReply(
  supabase: SupabaseClient,
  agentName: string,
  reply: ParsedReply
): Promise<void> {
  const fm = reply.raw

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const replyToIdNormalized = reply.replyToId && uuidRe.test(reply.replyToId) ? reply.replyToId : null

  const replyType = fm.type?.toLowerCase()

  // Special path: agent requests a risk approval. Route to approvals table
  // (via insertApprovalFromMarker) instead of the normal agent_messages insert,
  // so it shows up in the Risk-Approval tab of the dashboard.
  if (replyType === 'approval_request') {
    const result = await insertApprovalFromMarker(supabase, agentName, fm, reply.body, replyToIdNormalized)
    if (result.error) {
      console.error(`[file-drop] approval marker for ${agentName} failed: ${result.error}`)
    } else if (result.status === 'approved') {
      console.log(`[file-drop] approval ${result.approvalId} for ${agentName} auto-approved by policy ${result.autoApprovedBy}`)
    } else {
      console.log(`[file-drop] approval ${result.approvalId} for ${agentName} pending — visible in Risk-Approval tab`)
    }
    return
  }

  // Special path: agent proposes a cron job (create / update / delete). Route
  // to cron_requests instead of agent_messages so it shows up in the Routines
  // tab. high/critical risk also gets a parallel approvals row.
  if (replyType === 'cron_request') {
    const result = await insertCronRequestFromMarker(supabase, agentName, fm, reply.body, replyToIdNormalized)
    if (result.error) {
      console.error(`[file-drop] cron-request marker for ${agentName} failed: ${result.error}`)
    } else {
      const tail = result.approvalId ? ` (approval ${result.approvalId})` : ''
      console.log(`[file-drop] cron-request ${result.cronRequestId} for ${agentName} pending — risk=${result.riskLevel}${tail}`)
    }
    return
  }

  // Lift well-known cron/briefing fields from reply frontmatter into proper
  // metadata so downstream consumers (Briefings API, dashboards, RLS, etc.)
  // see them at top-level and don't have to dig into front_matter.
  const metadata: Record<string, unknown> = {
    generated_by: 'bridge_file_drop',
    front_matter: fm,
  }

  const outputKind = fm.output_kind?.toLowerCase()
  const sourceValue = fm.source?.toLowerCase()

  if (outputKind === 'briefing' || sourceValue === 'cron') {
    metadata.kind = 'briefing'
    metadata.source = sourceValue || 'cron'
  } else if (fm.kind) {
    metadata.kind = fm.kind
  }

  if (fm.job_id) metadata.job_id = fm.job_id
  if (fm.job_name) metadata.job_name = fm.job_name
  if (fm.briefing_title) metadata.title = fm.briefing_title
  if (fm.category) metadata.category = fm.category
  if (fm.urgency) metadata.urgency = fm.urgency

  // reply_to_id is a UUID column. If the agent echoed a non-UUID id (e.g. an
  // old cron trigger format), fall back to null instead of failing the insert.
  if (reply.replyToId && replyToIdNormalized === null) {
    console.warn(`[file-drop] dropped non-UUID reply_to_id="${reply.replyToId}" for ${agentName}, inserting briefing as orphan row`)
  }

  const insert = {
    agent_name: agentName,
    role: 'assistant',
    content: reply.body,
    reply_to_id: replyToIdNormalized,
    metadata,
  }
  const { error } = await supabase.from(TABLE).insert(insert)
  if (error) {
    console.error(`[file-drop] failed to insert reply for ${agentName}:`, error.message)
  }
}

export async function ensureAgentDir(agentsDir: string, agentName: string): Promise<void> {
  const base = agentDirFor(agentsDir, agentName)
  if (!existsSync(base)) {
    console.warn(
      `[file-drop] agent directory missing: ${base}\n` +
      `[file-drop] copy templates/agent-boilerplate/ to ${base} before starting the bridge in file_drop mode.`
    )
  }
  await ensureDir(path.join(base, 'inbox'))
  await ensureDir(path.join(base, 'inbox', 'processed'))
  await ensureDir(path.join(base, 'outbox'))
  await ensureDir(path.join(base, 'outbox', 'processed'))
}

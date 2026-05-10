import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import type { AgentMessage, BridgeConfig } from './types.ts'
import { writeInboxMessage } from './file-drop.ts'

const CRON_TABLE = 'agent_cron_jobs'
const MESSAGES_TABLE = 'agent_messages'

export type CronJob = {
  id: string
  agent_id: string
  name: string
  description: string | null
  prompt: string | null
  enabled: boolean
  schedule_hour: number | null
  schedule_minute: number | null
  schedule_day: number | null
  last_run_at: string | null
  last_status: string | null
  output_kind?: string | null
}

const triggeredThisTick = new Set<string>()

function shouldTrigger(job: CronJob, now: Date): boolean {
  if (!job.enabled) return false
  if (job.schedule_hour == null || job.schedule_minute == null) return false

  if (job.schedule_day != null && now.getDay() !== job.schedule_day) return false

  if (now.getHours() !== job.schedule_hour) return false
  if (now.getMinutes() !== job.schedule_minute) return false

  if (job.last_run_at) {
    const last = new Date(job.last_run_at)
    if (now.getTime() - last.getTime() < 60_000) return false
  }

  const tickKey = `${job.id}-${now.getFullYear()}${now.getMonth()}${now.getDate()}${now.getHours()}${now.getMinutes()}`
  if (triggeredThisTick.has(tickKey)) return false
  triggeredThisTick.add(tickKey)
  if (triggeredThisTick.size > 500) {
    const first = triggeredThisTick.values().next().value
    if (first) triggeredThisTick.delete(first)
  }

  return true
}

async function recordRun(
  supabase: SupabaseClient,
  jobId: string,
  status: 'triggered' | 'error',
  detail?: string
): Promise<void> {
  const { error } = await supabase
    .from(CRON_TABLE)
    .update({
      last_run_at: new Date().toISOString(),
      last_status: detail ? `${status}: ${detail}` : status,
    })
    .eq('id', jobId)
  if (error) {
    console.error(`[cron] failed to record run for ${jobId}:`, error.message)
  }
}

async function triggerJob(
  supabase: SupabaseClient,
  cfg: BridgeConfig,
  job: CronJob
): Promise<void> {
  const agentName = job.agent_id
  const basePrompt = job.prompt?.trim() || job.description?.trim() || `Cron job: ${job.name}`

  // Effective output kind defaults to 'cron' but auto-promotes to 'briefing'
  // when the job name/description/prompt clearly says it's a briefing/report.
  const heuristicReport = /briefing|report|maintenance/i
    .test(`${job.name}\n${job.description || ''}\n${job.prompt || ''}`)
  const outputKind = (job.output_kind || (heuristicReport ? 'briefing' : 'cron')).toLowerCase()
  const briefingTitle = job.name

  const promptLines = [basePrompt]
  if (outputKind === 'briefing') {
    promptLines.push('')
    promptLines.push('Wichtig: Schreibe deine Antwort als Briefing in die Outbox und uebernimm diese Frontmatter-Felder unveraendert in dein Reply, damit es im Mana-Hub-Briefings-Tab landet (nicht im Chat):')
    promptLines.push('')
    promptLines.push('```yaml')
    promptLines.push('output_kind: briefing')
    promptLines.push('source: cron')
    promptLines.push(`job_id: ${job.id}`)
    promptLines.push(`job_name: ${job.name}`)
    promptLines.push(`briefing_title: "${briefingTitle.replace(/"/g, "'")}"`)
    promptLines.push(`agent: ${agentName}`)
    promptLines.push('```')
  }

  const cronMessage: AgentMessage = {
    // Must be a valid UUID — agent_messages.reply_to_id is a UUID column,
    // and the agent uses this id in the outbox reply's reply_to_id.
    id: randomUUID(),
    agent_name: agentName,
    role: 'system',
    content: promptLines.join('\n'),
    reply_to_id: null,
    ticket_id: null,
    metadata: {
      kind: 'cron_trigger',
      job_id: job.id,
      job_name: job.name,
      output_kind: outputKind,
      source: 'cron',
      briefing_title: briefingTitle,
    },
    created_at: new Date().toISOString(),
  }

  try {
    if (cfg.mode === 'file_drop') {
      const filePath = await writeInboxMessage({
        agentsDir: cfg.agentsDir,
        agentName,
        msg: cronMessage,
        kind: 'cron',
      })
      console.log(`[cron] triggered job ${job.name} (output_kind=${outputKind}) -> ${filePath}`)
    } else {
      const { error } = await supabase.from(MESSAGES_TABLE).insert({
        agent_name: agentName,
        role: 'system',
        content: cronMessage.content,
        metadata: cronMessage.metadata,
      })
      if (error) throw error
      console.log(`[cron] triggered job ${job.name} (output_kind=${outputKind}) -> agent_messages (inline mode)`)
    }
    await recordRun(supabase, job.id, 'triggered')
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[cron] failed to trigger job ${job.name}:`, errMsg)
    await recordRun(supabase, job.id, 'error', errMsg)
  }
}

async function tickOnce(supabase: SupabaseClient, cfg: BridgeConfig): Promise<void> {
  const now = new Date()
  const { data, error } = await supabase
    .from(CRON_TABLE)
    .select('*')
    .eq('enabled', true)
    .in('agent_id', cfg.agentNames)

  if (error) {
    console.error('[cron] failed to load jobs:', error.message)
    return
  }

  const jobs = (data ?? []) as CronJob[]
  for (const job of jobs) {
    if (shouldTrigger(job, now)) {
      await triggerJob(supabase, cfg, job)
    }
  }
}

export type CronLoop = {
  stop: () => void
}

export function startCronLoop(supabase: SupabaseClient, cfg: BridgeConfig): CronLoop {
  console.log(`[cron] starting cron tick every ${cfg.cronTickIntervalMs}ms for agents: ${cfg.agentNames.join(', ')}`)

  void tickOnce(supabase, cfg)
  const handle = setInterval(() => {
    void tickOnce(supabase, cfg)
  }, cfg.cronTickIntervalMs)

  return {
    stop: () => {
      clearInterval(handle)
      console.log('[cron] stopped')
    },
  }
}

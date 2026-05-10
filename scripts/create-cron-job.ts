#!/usr/bin/env tsx
/**
 * Create / update / list / delete agent cron jobs in Supabase.
 *
 * Loads .env.local automatically (same pattern as scripts/doctor.ts), uses the
 * service-role key (bypasses RLS), and validates input with zod.
 *
 * Examples:
 *   npm run cron:create -- --help
 *   npm run cron:create -- --agent orchestrator --id orchestrator-morning-briefing \
 *                          --name "Morning Briefing" --schedule "07:30" \
 *                          --output-kind briefing \
 *                          --prompt "Schreib mir das taegliche Morgenbriefing nach §5.8."
 *   npm run cron:create -- --list
 *   npm run cron:create -- --list --agent orchestrator
 *   npm run cron:create -- --id orchestrator-morning-briefing --delete
 *
 * See docs/cron-and-briefings.md for the full contract.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { z } from 'zod'

const root = process.cwd()
const envPath = path.join(root, '.env.local')
if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    const key = m[1]
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

const HELP = `npm run cron:create — manage agent_cron_jobs in Supabase.

Usage:
  npm run cron:create -- [flags]

Modes (one required):
  (default)               Upsert a cron job. Requires --agent, --id, --name, --schedule.
  --list                  Print existing cron jobs (filterable with --agent).
  --delete                Delete a job. Requires --id.

Flags:
  --agent <name>          Lowercase agent name (matches ~/agents/<name>/).
  --id <kebab-id>         Stable job id (e.g. "orchestrator-morning-briefing"). Becomes job_id everywhere.
  --name <"Label">        Human label, becomes briefing_title.
  --schedule <HH:MM>      24h local time. Minute must be a multiple of 5 (warning otherwise).
  --day <0..6|every>      Weekday (0=Sun, 6=Sat) or "every" (default: every).
  --output-kind <value>   One of: cron, briefing, task, outcome, finance_action. Default: cron.
                          Use "briefing" for anything that should appear in the Briefings tab.
  --prompt <"text">       Inbox body the bridge sends. The bridge auto-appends the YAML mirror block
                          when output-kind=briefing.
  --description <"text">  Optional context for the agent.
  --enabled <true|false>  Default: true.
  --automation-type <v>   agent_cron | http_cron | self_cron. Default: agent_cron.
  --help                  Show this message.

Environment (loaded from .env.local):
  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
  SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY  (must be the secret/service-role key)

Reference: docs/cron-and-briefings.md
`

type Args = Record<string, string | boolean>

function parseArgs(argv: string[]): Args {
  const out: Args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = true
    } else {
      out[key] = next
      i++
    }
  }
  return out
}

function fail(msg: string): never {
  console.error(`[cron:create] ${msg}`)
  process.exit(1)
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) fail('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL in .env.local.')
  if (!key) fail('Missing SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY in .env.local.')
  if (url.includes('/rest/v1/')) {
    fail('SUPABASE_URL must be the bare project URL (e.g. https://abc.supabase.co), not the REST endpoint.')
  }
  // Lazy import so tsx does not require the package when only printing help.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js')
  return createClient(url, key, { auth: { persistSession: false } })
}

const cronJobSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/, 'id must be lowercase kebab-case, 2-80 chars'),
  agent_id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/, 'agent must be lowercase'),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable(),
  prompt: z.string().max(10_000).nullable(),
  enabled: z.boolean(),
  schedule_hour: z.number().int().min(0).max(23),
  schedule_minute: z.number().int().min(0).max(59),
  schedule_day: z.number().int().min(0).max(6).nullable(),
  output_kind: z.enum(['cron', 'briefing', 'task', 'outcome', 'finance_action']),
  automation_type: z.enum(['agent_cron', 'http_cron', 'self_cron']),
})

type CronJobInput = z.infer<typeof cronJobSchema>

function parseSchedule(raw: string): { hour: number; minute: number } {
  const m = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) fail(`--schedule must be HH:MM, got "${raw}"`)
  const hour = Number(m![1])
  const minute = Number(m![2])
  if (hour < 0 || hour > 23) fail(`--schedule hour out of range: ${hour}`)
  if (minute < 0 || minute > 59) fail(`--schedule minute out of range: ${minute}`)
  if (minute % 5 !== 0) {
    console.warn(`[cron:create] WARNING: --schedule minute ${minute} is not a multiple of 5.`)
    console.warn('              The bridge default cron tick is 300_000 ms (5 min). Non-multiples')
    console.warn('              may be missed on some ticks. Either pick a multiple of 5, or set')
    console.warn('              BRIDGE_CRON_TICK_INTERVAL_MS=60000 in bridge/.env.')
  }
  return { hour, minute }
}

function parseDay(raw: string | undefined): number | null {
  if (raw === undefined || raw === 'every' || raw === 'all' || raw === '*') return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > 6) fail(`--day must be 0..6 (Sun=0, Sat=6) or "every"`)
  return n
}

function buildJob(args: Args): CronJobInput {
  for (const required of ['agent', 'id', 'name', 'schedule'] as const) {
    if (typeof args[required] !== 'string') fail(`Missing required flag: --${required}`)
  }
  const sched = parseSchedule(String(args.schedule))
  const job: CronJobInput = {
    id: String(args.id),
    agent_id: String(args.agent),
    name: String(args.name),
    description: typeof args.description === 'string' ? String(args.description) : null,
    prompt: typeof args.prompt === 'string' ? String(args.prompt) : null,
    enabled: args.enabled === undefined ? true : String(args.enabled) === 'true',
    schedule_hour: sched.hour,
    schedule_minute: sched.minute,
    schedule_day: parseDay(typeof args.day === 'string' ? args.day : undefined),
    output_kind: (typeof args['output-kind'] === 'string'
      ? String(args['output-kind'])
      : 'cron') as CronJobInput['output_kind'],
    automation_type: (typeof args['automation-type'] === 'string'
      ? String(args['automation-type'])
      : 'agent_cron') as CronJobInput['automation_type'],
  }
  const parsed = cronJobSchema.safeParse(job)
  if (!parsed.success) {
    console.error('[cron:create] Validation errors:')
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }
  return parsed.data
}

async function upsert(args: Args) {
  const job = buildJob(args)
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('agent_cron_jobs')
    .upsert({ ...job, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select('id, agent_id, name, schedule_hour, schedule_minute, schedule_day, output_kind, enabled')
    .single()
  if (error) fail(`Upsert failed: ${error.message}`)
  console.log('[cron:create] OK — upserted:')
  console.log(JSON.stringify(data, null, 2))
  if (job.output_kind === 'briefing') {
    console.log('')
    console.log('[cron:create] output_kind=briefing → make sure the agent\'s CLAUDE.md contains the')
    console.log('              Cron-Briefings section. Drop-in snippet:')
    console.log('              templates/agent-boilerplate/snippets/briefing-routine.md')
    console.log('              Full spec: docs/cron-and-briefings.md')
  }
}

async function list(args: Args) {
  const supabase = getSupabaseClient()
  let query = supabase
    .from('agent_cron_jobs')
    .select('id, agent_id, name, enabled, schedule_hour, schedule_minute, schedule_day, output_kind, last_run_at, last_status')
    .order('agent_id', { ascending: true })
    .order('id', { ascending: true })
  if (typeof args.agent === 'string') {
    query = query.eq('agent_id', args.agent)
  }
  const { data, error } = await query
  if (error) fail(`List failed: ${error.message}`)
  if (!data || data.length === 0) {
    console.log('[cron:create] No cron jobs found.')
    return
  }
  console.log(`[cron:create] ${data.length} cron job(s):`)
  for (const row of data) {
    const day = row.schedule_day == null ? 'every' : `day=${row.schedule_day}`
    const time = `${String(row.schedule_hour ?? '?').padStart(2, '0')}:${String(row.schedule_minute ?? '?').padStart(2, '0')}`
    const tag = row.enabled ? 'on ' : 'off'
    console.log(`  [${tag}] ${row.agent_id}/${row.id}  ${time} ${day}  output_kind=${row.output_kind}  last=${row.last_status ?? '—'}`)
  }
}

async function remove(args: Args) {
  if (typeof args.id !== 'string') fail('Delete requires --id <job-id>.')
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('agent_cron_jobs').delete().eq('id', String(args.id))
  if (error) fail(`Delete failed: ${error.message}`)
  console.log(`[cron:create] OK — deleted job id=${args.id}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || args.h) {
    console.log(HELP)
    return
  }
  if (args.list) return await list(args)
  if (args.delete) return await remove(args)
  await upsert(args)
}

main().catch(err => {
  console.error('[cron:create] Unexpected error:', err?.stack ?? err)
  process.exit(1)
})

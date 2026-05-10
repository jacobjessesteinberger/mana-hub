import { config as loadDotenv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { z } from 'zod'
import type { BridgeConfig } from './types.ts'

const here = dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: resolve(here, '..', '.env') })

const placeholderPattern = /^(your-|sb_secret_REPLACE|sb_publishable_REPLACE|REPLACE_)/i

function expandHome(p: string): string {
  if (p.startsWith('~/')) return resolve(homedir(), p.slice(2))
  if (p === '~') return homedir()
  if (p.startsWith('$HOME/')) return resolve(homedir(), p.slice(6))
  if (p === '$HOME') return homedir()
  return p
}

const envSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SECRET_KEY: z.string().min(20, 'SUPABASE_SECRET_KEY looks too short'),
  BRIDGE_AGENT_NAMES: z.string().default('orchestrator'),
  BRIDGE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(3000),
  BRIDGE_ECHO_PREFIX: z.string().default('[echo-bridge] '),
  BRIDGE_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  BRIDGE_MODE: z.enum(['inline', 'file_drop']).default('inline'),
  BRIDGE_AGENTS_DIR: z.string().default('$HOME/agents'),
  BRIDGE_TMUX_ENABLED: z.enum(['true', 'false']).default('true'),
  BRIDGE_CRON_TICK_INTERVAL_MS: z.coerce.number().int().positive().default(300000),
})

export function loadConfig(): BridgeConfig {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(
      `Bridge env invalid:\n${issues}\n\nFix bridge/.env and try again.`
    )
  }

  const env = parsed.data

  if (placeholderPattern.test(env.SUPABASE_URL)) {
    throw new Error(
      'SUPABASE_URL is still a placeholder. Set it in bridge/.env to your Supabase project URL.'
    )
  }
  if (env.SUPABASE_URL.includes('/rest/v1')) {
    throw new Error(
      'SUPABASE_URL contains "/rest/v1/". Use only the base URL like https://abc.supabase.co (no path suffix).'
    )
  }
  if (placeholderPattern.test(env.SUPABASE_SECRET_KEY)) {
    throw new Error(
      'SUPABASE_SECRET_KEY is still a placeholder. Paste your sb_secret_... from Supabase Project Settings -> API Keys into bridge/.env.'
    )
  }

  const agentNames = env.BRIDGE_AGENT_NAMES
    .split(',')
    .map(n => n.trim())
    .filter(Boolean)

  if (agentNames.length === 0) {
    throw new Error('BRIDGE_AGENT_NAMES is empty. Set at least one agent name (e.g. "orchestrator").')
  }

  return {
    supabaseUrl: env.SUPABASE_URL,
    supabaseSecretKey: env.SUPABASE_SECRET_KEY,
    agentNames,
    pollIntervalMs: env.BRIDGE_POLL_INTERVAL_MS,
    echoPrefix: env.BRIDGE_ECHO_PREFIX,
    heartbeatIntervalMs: env.BRIDGE_HEARTBEAT_INTERVAL_MS,
    mode: env.BRIDGE_MODE,
    agentsDir: expandHome(env.BRIDGE_AGENTS_DIR),
    tmuxEnabled: env.BRIDGE_TMUX_ENABLED === 'true',
    cronTickIntervalMs: env.BRIDGE_CRON_TICK_INTERVAL_MS,
  }
}

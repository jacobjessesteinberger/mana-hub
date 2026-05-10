import { loadConfig } from './env.ts'
import { createBridgeClient } from './supabase.ts'
import { startConnector } from './connector.ts'
import { startHeartbeats } from './heartbeat.ts'
import { startCronLoop } from './cron.ts'
import { abortAll } from './stop.ts'
import { setIdle } from './activity.ts'

async function main(): Promise<void> {
  let cfg
  try {
    cfg = loadConfig()
  } catch (err) {
    console.error('\n' + (err instanceof Error ? err.message : String(err)) + '\n')
    process.exit(1)
  }

  console.log('Mana Hub Bridge')
  console.log('  supabase url: ' + cfg.supabaseUrl)
  console.log('  agents:       ' + cfg.agentNames.join(', '))
  console.log('  mode:         ' + cfg.mode)
  if (cfg.mode === 'file_drop') {
    console.log('  agents dir:   ' + cfg.agentsDir)
    console.log('  tmux notify:  ' + cfg.tmuxEnabled)
  }
  console.log('  poll:         ' + cfg.pollIntervalMs + 'ms')
  console.log('  heartbeat:    ' + cfg.heartbeatIntervalMs + 'ms')
  console.log('  cron tick:    ' + cfg.cronTickIntervalMs + 'ms')
  console.log('')

  const supabase = createBridgeClient(cfg)
  const connector = await startConnector(supabase, cfg)
  const heartbeats = startHeartbeats(supabase, cfg.agentNames, cfg.heartbeatIntervalMs)
  const cron = startCronLoop(supabase, cfg)

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`\n[bridge] ${signal} received, shutting down...`)
    abortAll(`bridge ${signal}`)
    cron.stop()
    heartbeats.stop()
    await connector.stop()
    await Promise.allSettled(
      cfg.agentNames.map(name => setIdle(supabase, name, 'idle', 'Bridge shut down'))
    )
    console.log('[bridge] goodbye')
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('uncaughtException', (err) => {
    console.error('[bridge] uncaught exception:', err)
  })
  process.on('unhandledRejection', (reason) => {
    console.error('[bridge] unhandled rejection:', reason)
  })

  console.log('[bridge] running. Press Ctrl+C to stop.')
}

void main()

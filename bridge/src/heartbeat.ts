import type { SupabaseClient } from '@supabase/supabase-js'

const TABLE = 'agent_heartbeats'

export type HeartbeatLoop = {
  stop: () => void
}

export function startHeartbeats(
  supabase: SupabaseClient,
  agentNames: string[],
  intervalMs: number
): HeartbeatLoop {
  const startedAt = Date.now()

  async function tick() {
    const uptimeMin = Math.max(1, Math.round((Date.now() - startedAt) / 60_000))
    for (const agentName of agentNames) {
      const { error } = await supabase.from(TABLE).insert({
        agent_name: agentName,
        status: 'online',
        session_uptime_minutes: uptimeMin,
        context_usage_percent: 0,
        current_task: 'bridge listening',
      })
      if (error) {
        console.error(`[heartbeat] insert failed for ${agentName}:`, error.message)
      }
    }
  }

  void tick()
  const handle = setInterval(() => {
    void tick()
  }, intervalMs)

  return {
    stop: () => clearInterval(handle),
  }
}

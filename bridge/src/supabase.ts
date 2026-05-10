import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { BridgeConfig } from './types.ts'

export function createBridgeClient(cfg: BridgeConfig): SupabaseClient {
  return createClient(cfg.supabaseUrl, cfg.supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  })
}

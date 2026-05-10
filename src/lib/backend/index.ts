import { createServerSupabase } from '@/lib/supabase'
import { demoBackendAdapter } from './demo-adapter'
import { createSupabaseBackendAdapter } from './supabase-adapter'
import type { ManaHubBackendAdapter } from './types'

export function getBackendAdapter(): ManaHubBackendAdapter {
  if (process.env.MANA_HUB_DEMO_MODE === 'true') {
    return demoBackendAdapter
  }

  if (process.env.MANA_HUB_BACKEND === 'custom') {
    throw new Error('Custom backend adapter is not configured. Implement src/lib/backend/custom-adapter.ts for your setup.')
  }

  return createSupabaseBackendAdapter(createServerSupabase())
}

export type { ManaHubApproval, ManaHubBackendAdapter, ManaHubIssue } from './types'

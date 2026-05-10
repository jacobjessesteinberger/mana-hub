import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env: ${name}`)
  return value
}

let browserSupabase: SupabaseClient | null = null

function getBrowserSupabase() {
  if (!browserSupabase) {
    browserSupabase = createSupabaseClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    )
  }

  return browserSupabase
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getBrowserSupabase(), prop)
  },
})

// Create a new client instance (for use in hooks/components)
export function createClient() {
  return createSupabaseClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  )
}

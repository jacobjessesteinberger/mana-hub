import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const isDemoMode = process.env.NEXT_PUBLIC_MANA_HUB_DEMO_MODE === 'true'

function requireValue(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env: ${name}`)
  return value
}

/**
 * Demo Stub: a no-op SupabaseClient surface so the dashboard can run
 * without a real Supabase connection in MANA_HUB_DEMO_MODE.
 *
 * Anything not implemented here returns harmless empty data instead of throwing,
 * so realtime channels, auth callbacks and one-off queries do not crash the UI.
 */
function createDemoClient(): SupabaseClient {
  const noopChannel = {
    on() { return noopChannel },
    subscribe() { return noopChannel },
    unsubscribe() { return Promise.resolve('ok' as const) },
  }
  const stub = {
    auth: {
      async getSession() { return { data: { session: null }, error: null } },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } }
      },
      async signInWithPassword() { return { data: { user: null, session: null }, error: null } },
      async signUp() { return { data: { user: null, session: null }, error: null } },
      async signInWithOtp() { return { data: { user: null, session: null }, error: null } },
      async signInWithOAuth() { return { data: { provider: 'google', url: null }, error: null } },
      async signOut() { return { error: null } },
    },
    channel() { return noopChannel },
    removeChannel() { return Promise.resolve('ok' as const) },
    from() {
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      ;[
        'select', 'insert', 'update', 'delete', 'upsert',
        'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is',
        'like', 'ilike', 'or', 'and', 'order', 'limit', 'range',
        'single', 'maybeSingle', 'returns',
      ].forEach(method => {
        builder[method] = chain
      })
      builder.then = (resolve: (v: { data: never[]; error: null }) => void) =>
        resolve({ data: [], error: null })
      return builder
    },
  }
  return stub as unknown as SupabaseClient
}

let browserSupabase: SupabaseClient | null = null

function getBrowserSupabase() {
  if (!browserSupabase) {
    if (isDemoMode) {
      browserSupabase = createDemoClient()
    } else {
      browserSupabase = createSupabaseClient(
        requireValue('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl),
        requireValue('NEXT_PUBLIC_SUPABASE_ANON_KEY', supabaseAnonKey),
      )
    }
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
  if (isDemoMode) return createDemoClient()
  return createSupabaseClient(
    requireValue('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl),
    requireValue('NEXT_PUBLIC_SUPABASE_ANON_KEY', supabaseAnonKey),
  )
}

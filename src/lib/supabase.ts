import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const isDemoModeServer = process.env.MANA_HUB_DEMO_MODE === 'true'
const isDemoModeClient = process.env.NEXT_PUBLIC_MANA_HUB_DEMO_MODE === 'true'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env: ${name}`)
  return value
}

/**
 * Demo Stub: a no-op SupabaseClient surface so the dashboard and API routes
 * can run without a real Supabase connection in MANA_HUB_DEMO_MODE.
 *
 * Returns harmless empty data instead of throwing, so realtime, auth and
 * one-off queries do not crash UI or API routes.
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
    rpc() { return Promise.resolve({ data: [], error: null }) },
    from() {
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      ;[
        'select', 'insert', 'update', 'delete', 'upsert',
        'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is',
        'like', 'ilike', 'or', 'and', 'order', 'limit', 'range',
        'returns',
      ].forEach(method => {
        builder[method] = chain
      })
      const single = () => Promise.resolve({ data: null, error: null })
      builder.single = single
      builder.maybeSingle = single
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
    if (isDemoModeClient) {
      browserSupabase = createDemoClient()
    } else {
      browserSupabase = createClient(
        requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
        requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
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

// Server-side client with service role.
// Returns a no-op stub in MANA_HUB_DEMO_MODE so API routes do not crash
// when Supabase env vars are intentionally absent.
export function createServerSupabase() {
  if (isDemoModeServer) return createDemoClient()
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

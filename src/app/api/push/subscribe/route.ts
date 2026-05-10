import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthResponse } from '@/lib/auth/middleware'
import { createServerSupabase } from '@/lib/supabase'

const isDemoMode = process.env.MANA_HUB_DEMO_MODE === 'true'

interface SubscribeBody {
  endpoint?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
  userAgent?: unknown
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthResponse(auth)) return auth

  if (isDemoMode) {
    return NextResponse.json({ ok: true, demo: true })
  }

  let body: SubscribeBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : null
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : null
  const authKey = typeof body.keys?.auth === 'string' ? body.keys.auth : null
  const userAgent = typeof body.userAgent === 'string' ? body.userAgent.slice(0, 500) : null

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: 'endpoint, keys.p256dh and keys.auth required' }, { status: 400 })
  }

  const supabase = createServerSupabase()

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        endpoint,
        p256dh,
        auth: authKey,
        user_agent: userAgent,
        user_email: auth.email || null,
        updated_at: new Date().toISOString(),
        last_error: null,
        failure_count: 0,
      },
      { onConflict: 'endpoint' },
    )
    .select('id')
    .single()

  if (error) {
    console.error('push subscribe upsert error:', error.message)
    return NextResponse.json({ error: 'Failed to register subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data?.id })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthResponse(auth)) return auth

  if (isDemoMode) return NextResponse.json({ ok: true, demo: true })

  let body: { endpoint?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : null
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) {
    console.error('push unsubscribe error:', error.message)
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

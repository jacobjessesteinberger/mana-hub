import { NextRequest, NextResponse } from 'next/server'
import { sendPushToAdmin } from '@/lib/push/server'

/**
 * Internal endpoint for service-to-service push notifications (Bridge → App).
 *
 * Authenticated via the shared secret env var MANA_HUB_INTERNAL_PUSH_TOKEN.
 * Only used by the Bridge after it inserts an approval or cron-request via
 * the service-role Supabase client (which bypasses /api/agents/* and would
 * otherwise miss the push hook there).
 *
 * In demo mode the endpoint accepts the call but the underlying
 * sendPushToAdmin no-ops.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.MANA_HUB_INTERNAL_PUSH_TOKEN?.trim()

  if (!expected) {
    return NextResponse.json(
      { error: 'Internal push endpoint disabled (set MANA_HUB_INTERNAL_PUSH_TOKEN)' },
      { status: 503 },
    )
  }

  const supplied = req.headers.get('x-mana-hub-internal-token')
  if (supplied !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { title?: unknown; body?: unknown; url?: unknown; tag?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title : null
  const text = typeof body.body === 'string' ? body.body : null
  if (!title || !text) {
    return NextResponse.json({ error: 'title and body required' }, { status: 400 })
  }

  const result = await sendPushToAdmin({
    title,
    body: text,
    url: typeof body.url === 'string' ? body.url : undefined,
    tag: typeof body.tag === 'string' ? body.tag : undefined,
  })

  return NextResponse.json({
    ok: result.errors.length === 0,
    attempted: result.attempted,
    delivered: result.delivered,
    removed: result.removed,
  })
}

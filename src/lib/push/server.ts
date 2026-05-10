/**
 * Server-side Web Push helper.
 *
 * Reads VAPID keys from env (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
 * VAPID_SUBJECT), looks up active subscriptions for the admin user, and sends
 * a payload via the standard Web Push protocol.
 *
 * Generate keys once with:
 *   npx web-push generate-vapid-keys
 *
 * Drop them into .env.local. The same NEXT_PUBLIC_VAPID_PUBLIC_KEY value is
 * also consumed by the browser (see src/lib/push/client.ts).
 */

import webpush, { type PushSubscription as WebPushSubscription } from 'web-push'
import { createServerSupabase } from '@/lib/supabase'

let vapidConfigured = false

function ensureVapid(): { ok: true } | { ok: false; reason: string } {
  if (vapidConfigured) return { ok: true }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@example.com'

  if (!publicKey || !privateKey) {
    return {
      ok: false,
      reason: 'VAPID keys missing (set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)',
    }
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  return { ok: true }
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  icon?: string
}

export interface PushSendResult {
  attempted: number
  delivered: number
  removed: number
  errors: string[]
}

/**
 * Send a push notification to every stored subscription that matches the
 * given recipient email (defaults to the admin email from env).
 *
 * Silently no-ops in demo mode and when VAPID keys are missing — that lets the
 * dashboard / API layer call this on every approval/cron-request without
 * needing branching logic.
 */
export async function sendPushToAdmin(
  payload: PushPayload,
  options: { recipientEmail?: string } = {},
): Promise<PushSendResult> {
  const result: PushSendResult = { attempted: 0, delivered: 0, removed: 0, errors: [] }

  if (process.env.MANA_HUB_DEMO_MODE === 'true') return result

  const vapid = ensureVapid()
  if (!vapid.ok) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[push] ${vapid.reason}`)
    }
    return result
  }

  const recipient = (options.recipientEmail || process.env.ADMIN_EMAIL || '').trim()
  if (!recipient) {
    result.errors.push('No recipient email (set ADMIN_EMAIL)')
    return result
  }

  const supabase = createServerSupabase()
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .or(`user_email.eq.${recipient},user_email.is.null`)

  if (error) {
    result.errors.push(`subscriptions query failed: ${error.message}`)
    return result
  }
  if (!subs || subs.length === 0) return result

  result.attempted = subs.length
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/dashboard/agents',
    tag: payload.tag || 'mana-hub-notification',
    icon: payload.icon,
  })

  await Promise.all(
    subs.map(async (sub) => {
      const subscription: WebPushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }

      try {
        await webpush.sendNotification(subscription, body)
        result.delivered += 1
        await supabase
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString(), last_error: null, failure_count: 0 })
          .eq('id', sub.id)
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode
        const message = err instanceof Error ? err.message : String(err)

        if (status === 404 || status === 410) {
          // Endpoint is dead (browser unsubscribed or browser cleared). Drop it
          // so we stop trying.
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          result.removed += 1
          return
        }

        result.errors.push(message)
        await supabase
          .from('push_subscriptions')
          .update({
            last_error: message.slice(0, 500),
            failure_count: 1, // best-effort; we don't read-modify-write on hot path
          })
          .eq('id', sub.id)
      }
    }),
  )

  return result
}

/**
 * Convenience wrapper that swallows everything: best-effort fire-and-forget
 * for non-critical notification sends from API routes.
 */
export function sendPushToAdminSafe(payload: PushPayload): void {
  sendPushToAdmin(payload).catch((err) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[push] sendPushToAdminSafe failed:', err)
    }
  })
}

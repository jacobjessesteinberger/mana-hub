/**
 * Bridge → Dashboard push-notification trigger.
 *
 * The Bridge writes approvals and cron-requests directly into Supabase via
 * the service-role client (bypassing /api/agents/* where the dashboard's own
 * push-hook lives). This helper closes that gap by calling the dashboard's
 * internal push endpoint.
 *
 * Activation:
 *   - MANA_HUB_PUSH_NOTIFY_URL — full URL of the Mana Hub dashboard's
 *     internal push endpoint, e.g. "http://localhost:3000/api/push/notify-internal"
 *   - MANA_HUB_INTERNAL_PUSH_TOKEN — same shared secret as in the dashboard's
 *     env. Required by the endpoint.
 *
 * If either var is missing this is a silent no-op so a clean install without
 * web-push setup still works.
 */

export interface BridgePushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

export async function notifyDashboard(payload: BridgePushPayload): Promise<void> {
  const endpoint = process.env.MANA_HUB_PUSH_NOTIFY_URL?.trim()
  const token = process.env.MANA_HUB_INTERNAL_PUSH_TOKEN?.trim()
  if (!endpoint || !token) return

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-mana-hub-internal-token': token,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn(`[bridge-push] dashboard rejected push (${res.status}): ${text.slice(0, 200)}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[bridge-push] failed to notify dashboard: ${message}`)
  }
}

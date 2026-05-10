/**
 * Browser-side Web Push helper.
 *
 * Registers /sw.js, asks the user for notification permission, subscribes
 * via PushManager, and POSTs the resulting subscription to the dashboard so
 * the server can later send notifications.
 *
 * The Service Worker itself only handles `push` and `notificationclick`
 * events — see public/sw.js. Subscription lifecycle stays client-side.
 */

import { authFetch } from '@/lib/auth-fetch'

export type PushSupportState =
  | { supported: false; reason: 'no-window' | 'no-sw' | 'no-push' | 'no-notification' }
  | { supported: true; permission: NotificationPermission }

export function getPushSupport(): PushSupportState {
  if (typeof window === 'undefined') return { supported: false, reason: 'no-window' }
  if (!('serviceWorker' in navigator)) return { supported: false, reason: 'no-sw' }
  if (!('PushManager' in window)) return { supported: false, reason: 'no-push' }
  if (!('Notification' in window)) return { supported: false, reason: 'no-notification' }
  return { supported: true, permission: Notification.permission }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Url = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64Url)
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  let registration = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!registration) {
    registration = await navigator.serviceWorker.register('/sw.js')
  }
  // On first install the SW may still be activating; wait for it.
  await navigator.serviceWorker.ready
  return registration
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  const support = getPushSupport()
  if (!support.supported) return null
  const registration = await getRegistration()
  return registration.pushManager.getSubscription()
}

export interface SubscribeResult {
  ok: boolean
  reason?: string
  subscription?: PushSubscription
}

/**
 * Idempotent: re-using the same VAPID key returns the existing subscription.
 * Sends the subscription to /api/push/subscribe so the server can deliver
 * notifications later.
 */
export async function subscribeToPush(): Promise<SubscribeResult> {
  const support = getPushSupport()
  if (!support.supported) return { ok: false, reason: support.reason }

  if (Notification.permission === 'denied') {
    return { ok: false, reason: 'permission-denied' }
  }
  if (Notification.permission === 'default') {
    const granted = await Notification.requestPermission()
    if (granted !== 'granted') return { ok: false, reason: 'permission-denied' }
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  if (!vapidKey) return { ok: false, reason: 'no-vapid-key' }

  const registration = await getRegistration()

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }

  const json = subscription.toJSON()
  const res = await authFetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    }),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    return { ok: false, reason: `register-failed: ${res.status} ${txt.slice(0, 120)}` }
  }

  return { ok: true, subscription }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean; reason?: string }> {
  const support = getPushSupport()
  if (!support.supported) return { ok: false, reason: support.reason }

  const subscription = await getCurrentPushSubscription()
  if (!subscription) return { ok: true }

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()

  await authFetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => undefined)

  return { ok: true }
}

export async function sendTestPush(): Promise<{ ok: boolean; reason?: string }> {
  const res = await authFetch('/api/push/test', { method: 'POST' })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    return { ok: false, reason: `${res.status} ${txt.slice(0, 120)}` }
  }
  return { ok: true }
}

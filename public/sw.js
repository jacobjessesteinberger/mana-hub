const CACHE_NAME = 'mana-hub-starter-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Mana Hub', body: event.data.text() }
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: payload.tag || 'mana-hub-notification',
    renotify: true,
    data: {
      url: payload.url || '/dashboard/agents',
    },
    actions: payload.actions || [],
  }

  event.waitUntil(self.registration.showNotification(payload.title || 'Mana Hub', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const raw = event.notification.data?.url || '/dashboard/agents'
  let targetUrl = '/dashboard/agents'

  try {
    const parsed = new URL(raw, self.location.origin)
    if (parsed.origin === self.location.origin) {
      targetUrl = parsed.pathname + parsed.search + parsed.hash
    }
  } catch {
    targetUrl = '/dashboard/agents'
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    })
  )
})

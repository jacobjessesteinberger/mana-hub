'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, AlertTriangle, CheckCircle2, Send } from 'lucide-react'
import {
  getCurrentPushSubscription,
  getPushSupport,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
} from '@/lib/push/client'

type Status = 'loading' | 'unsupported' | 'no-vapid' | 'denied' | 'unsubscribed' | 'subscribed' | 'error'

interface State {
  status: Status
  message: string
}

const STATUS_LABELS: Record<Status, string> = {
  loading: 'Lade Status …',
  unsupported: 'Browser unterstützt keine Web-Push-Notifications',
  'no-vapid': 'Push noch nicht eingerichtet (VAPID-Keys fehlen)',
  denied: 'Notifications vom Browser blockiert',
  unsubscribed: 'Nicht abonniert',
  subscribed: 'Aktiv: Du bekommst Notifications für neue Risk-Approvals und Cron-Vorschläge',
  error: 'Fehler',
}

const STATUS_TONE: Record<Status, 'ok' | 'warn' | 'err' | 'idle'> = {
  loading: 'idle',
  unsupported: 'warn',
  'no-vapid': 'warn',
  denied: 'err',
  unsubscribed: 'idle',
  subscribed: 'ok',
  error: 'err',
}

export default function PushNotificationCard() {
  const [{ status, message }, setState] = useState<State>({ status: 'loading', message: '' })
  const [busy, setBusy] = useState(false)
  const [testFeedback, setTestFeedback] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined') return
    const support = getPushSupport()
    if (!support.supported) {
      setState({ status: 'unsupported', message: STATUS_LABELS.unsupported })
      return
    }
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setState({ status: 'no-vapid', message: STATUS_LABELS['no-vapid'] })
      return
    }
    if (support.permission === 'denied') {
      setState({ status: 'denied', message: STATUS_LABELS.denied })
      return
    }
    const sub = await getCurrentPushSubscription()
    setState({
      status: sub ? 'subscribed' : 'unsubscribed',
      message: sub ? STATUS_LABELS.subscribed : STATUS_LABELS.unsubscribed,
    })
  }, [])

  useEffect(() => {
    queueMicrotask(() => { void refresh() })
  }, [refresh])

  const handleSubscribe = async () => {
    setBusy(true)
    setTestFeedback(null)
    const result = await subscribeToPush()
    if (!result.ok) {
      setState({ status: 'error', message: `Konnte nicht abonnieren: ${result.reason}` })
    } else {
      setState({ status: 'subscribed', message: STATUS_LABELS.subscribed })
    }
    setBusy(false)
  }

  const handleUnsubscribe = async () => {
    setBusy(true)
    setTestFeedback(null)
    await unsubscribeFromPush()
    await refresh()
    setBusy(false)
  }

  const handleTest = async () => {
    setBusy(true)
    setTestFeedback(null)
    const result = await sendTestPush()
    setTestFeedback(result.ok
      ? 'Test-Notification gesendet. Sollte gleich aufploppen.'
      : `Test fehlgeschlagen: ${result.reason}`)
    setBusy(false)
  }

  const tone = STATUS_TONE[status]
  const toneColor = tone === 'ok' ? 'var(--success)'
    : tone === 'warn' ? 'var(--warn)'
    : tone === 'err' ? 'var(--err)'
    : 'var(--fg-muted)'
  const Icon = status === 'subscribed' ? CheckCircle2
    : status === 'denied' || status === 'error' ? AlertTriangle
    : status === 'unsupported' || status === 'no-vapid' ? AlertTriangle
    : Bell

  return (
    <div className="card">
      <div className="card-hd">
        <h3 className="row gap-2" style={{ alignItems: 'center' }}>
          <Bell size={14} />
          Web-Push Notifications
        </h3>
      </div>
      <div className="card-bd col gap-3">
        <div className="row gap-2" style={{ alignItems: 'flex-start' }}>
          <Icon size={14} style={{ color: toneColor, flex: 'none', marginTop: 2 }} />
          <div style={{ fontSize: 13, color: 'var(--fg)' }}>{message || STATUS_LABELS[status]}</div>
        </div>

        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
          Wenn aktiv, schickt der Server eine Browser-Notification an deinen Rechner / dein Handy,
          sobald ein Agent eine Risk Approval anfragt oder einen Cron-Vorschlag einreicht — auch wenn
          der Mana-Hub-Tab gerade geschlossen ist. Du musst pro Browser einmalig zustimmen.
        </p>

        {status === 'no-vapid' && (
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', background: 'var(--surface-2)', padding: 10, borderRadius: 8 }}>
            <strong>Setup:</strong> In einem Terminal:
            <pre style={{ fontSize: 11, margin: '6px 0' }}>npx web-push generate-vapid-keys</pre>
            Trage <code>publicKey</code>, <code>privateKey</code> in <code>.env.local</code> als
            <code> NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>, <code> VAPID_PRIVATE_KEY</code> und
            optional <code> VAPID_SUBJECT=&quot;mailto:du@example.com&quot;</code> ein, danach Server neu starten.
          </div>
        )}

        {status === 'denied' && (
          <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
            Du musst Notifications für diese Seite in den Browser-Einstellungen wieder erlauben — zurücksetzen
            geht meist über das Schloss-Icon links neben der Adresszeile.
          </div>
        )}

        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          {status === 'unsubscribed' && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleSubscribe}
              disabled={busy}
            >
              <Bell size={12} /> Notifications aktivieren
            </button>
          )}
          {status === 'subscribed' && (
            <>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleUnsubscribe}
                disabled={busy}
              >
                <BellOff size={12} /> Deaktivieren
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleTest}
                disabled={busy}
              >
                <Send size={12} /> Test senden
              </button>
            </>
          )}
        </div>

        {testFeedback && (
          <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{testFeedback}</div>
        )}
      </div>
    </div>
  )
}

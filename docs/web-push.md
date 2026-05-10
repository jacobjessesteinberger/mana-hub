# Web-Push Notifications

Mana Hub kann dem User echte Browser- bzw. OS-Notifications schicken, sobald
ein Agent eine Risk Approval anfragt oder einen Cron-Vorschlag einreicht — auch
wenn der Mana-Hub-Tab gerade geschlossen ist.

Komplett optional. Ohne VAPID-Setup laufen Dashboard und Bridge unverändert,
nur die Push-Karte im Setup zeigt „nicht eingerichtet".

## Architektur

```
Agent
  └─ outbox/reply-….md                                       (type: approval_request | cron_request)
      └─ Bridge (file-drop.ts)
          ├─ insertApprovalFromMarker / insertCronRequestFromMarker
          │     ↓ (service-role write)
          │   approvals / cron_requests Tabelle
          └─ notifyDashboard()  →  POST /api/push/notify-internal
                                          ↓
                                  sendPushToAdmin()
                                          ↓
                                  web-push → push_subscriptions → Browser
                                                                       ↓
                                                                public/sw.js → showNotification
```

API-Routes (Risk-Approval und Cron-Request) im Dashboard rufen
`sendPushToAdminSafe()` direkt — die Bridge geht den Umweg über
`/api/push/notify-internal`, weil sie die Approvals/Cron-Requests selbst direkt
in Supabase schreibt und damit den dashboardseitigen Hook umgeht.

## 1. VAPID-Schlüssel erzeugen

Einmal pro Installation, in irgendeinem Terminal:

```bash
npx web-push generate-vapid-keys
```

Ausgabe:

```
=======================================
Public Key:
BMx…
Private Key:
abc…
=======================================
```

## 2. Dashboard-`.env.local`

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY="BMx…"
VAPID_PRIVATE_KEY="abc…"
VAPID_SUBJECT="mailto:du@example.com"
ADMIN_EMAIL="du@example.com"

# Wird auch von der Bridge gebraucht — dasselbe Geheimnis auf beiden Seiten:
MANA_HUB_INTERNAL_PUSH_TOKEN="$(openssl rand -hex 32)"
```

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` wird im Browser benutzt (deshalb der `NEXT_PUBLIC_`-Prefix). Den Private Key niemals committen oder weitergeben.

`ADMIN_EMAIL` muss mit dem Login-Account übereinstimmen — Subscriptions werden
pro `user_email` gespeichert; nur passende werden bei einem Push angesprochen.

## 3. Bridge-`bridge/.env`

Damit Bridge-getriebene Approvals/Cron-Requests auch Notifications auslösen,
auf der Bridge-Seite ergänzen:

```env
MANA_HUB_PUSH_NOTIFY_URL="http://localhost:3000/api/push/notify-internal"
MANA_HUB_INTERNAL_PUSH_TOKEN="<derselbe Wert wie im Dashboard>"
```

Wenn die Bridge auf einem anderen Host läuft als das Dashboard, hier die
erreichbare URL des Dashboards eintragen.

## 4. Migration laufen lassen

```bash
# Supabase SQL Editor: supabase/migrations/20260510_push_subscriptions.sql
```

Legt die Tabelle `push_subscriptions` an.

## 5. Dashboard neu starten und Subscription anlegen

1. `npm run dev` neu starten.
2. Dashboard öffnen → `Setup` (Sidebar Company-Bereich) → Karte „Web-Push
   Notifications" rechts.
3. Auf „Notifications aktivieren" klicken. Browser fragt nach Permission →
   „Erlauben".
4. „Test senden" sollte sofort eine Notification triggern.

Pro Browser musst du das einmal machen. Subscriptions sind pro Browser-Instanz
eindeutig und werden in `push_subscriptions` gespeichert.

## Was triggert eine Notification?

- **Risk Approval angefragt**
  - via Dashboard-API: `POST /api/agents/approvals` (z. B. manuelle
    Approval-Erzeugung) — Hook in der Route.
  - via Bridge: Agent schreibt `type: approval_request` in seine Outbox →
    `bridge/src/approvals.ts` → `notifyDashboard()`.
- **Cron-Vorschlag eingereicht**
  - via Dashboard-API: `POST /api/agents/cron-requests` — Hook in der Route.
  - via Bridge: Agent schreibt `type: cron_request` →
    `bridge/src/cron-requests.ts` → `notifyDashboard()`.

Auto-genehmigte Approvals (Always-Policy match) lösen **keine** Push-Notification
aus — der User wollte das ja explizit nicht mehr sehen.

## Demo Mode

Im Demo Mode (`MANA_HUB_DEMO_MODE=true`) sind alle Push-Endpoints No-Ops:

- `/api/push/subscribe` antwortet `{ ok: true, demo: true }` ohne DB-Write.
- `sendPushToAdmin` bricht sofort ab.
- Die UI-Karte zeigt trotzdem „aktiv", die Notifications werden aber nicht
  gesendet.

Erst Demo Mode aus + VAPID-Keys eintragen + Subscription anlegen → real.

## Datenschutz / Lifecycle

- `push_subscriptions` enthält Endpoint-URL + Public-Keys (kein
  personenbezogenes Detail über das hinaus, was Browser ohnehin senden) und
  optional `user_agent`.
- Tote Endpoints (`410 Gone`, `404 Not Found`) löscht der Server automatisch.
- Über die Karte „Deaktivieren" kann der User jederzeit unsubscriben.
- Der Service Worker (`public/sw.js`) zeigt nur das, was der Server in der
  `push`-Payload mitschickt — kein Zugriff auf Datenbank oder Cookies.

## Troubleshooting

- **Karte zeigt „VAPID-Keys fehlen"**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` nicht
  gesetzt oder Server nicht neu gestartet.
- **Karte zeigt „Browser blockiert"**: User hat Permission verweigert.
  Reset über das Schloss-Icon in der Adresszeile.
- **„Test senden" liefert `errors`**: meist falsche `VAPID_SUBJECT`-URL
  (muss `mailto:…` oder `https://…` sein), oder Endpoint im Push-Provider
  bereits abgelaufen.
- **Keine Notifications für Bridge-Inserts**: prüfe, dass beide Seiten dasselbe
  `MANA_HUB_INTERNAL_PUSH_TOKEN` haben und die `MANA_HUB_PUSH_NOTIFY_URL` von
  der Bridge erreichbar ist (`curl` testet das schnell).

# Cron-System (Überblick)

> **Looking for the end-to-end flow + briefing format?** That lives in
> [`docs/cron-and-briefings.md`](./cron-and-briefings.md). This page is a
> short component overview.

Mana Hub speichert geplante Agent-Jobs in Supabase und stößt sie über die
Bridge an. Es gibt zwei Klassen von Cron-Daten:

| Tabelle | Zweck |
| --- | --- |
| `agent_cron_jobs` | aktive, vom User akzeptierte Jobs. Die Bridge tickt sie. |
| `cron_requests` | Vorschläge / Änderungswünsche, die auf Genehmigung warten. |

## Trigger-Pfad

Der Cron-Tick läuft in `bridge/src/cron.ts` mit Intervall
`BRIDGE_CRON_TICK_INTERVAL_MS` (Default 5 Minuten). Pro fälligem Job:

- **`BRIDGE_MODE=inline`:** schreibt eine Zeile in `agent_messages` mit
  `metadata.kind=cron_trigger`. Der Inline-Handler in `bridge/src/handler.ts`
  ist der Anschlusspunkt für eigene LLM-Aufrufe.
- **`BRIDGE_MODE=file_drop`:** legt eine `cron-*.md`-Datei ins
  `inbox/`-Verzeichnis des Agents (User Space, `BRIDGE_AGENTS_DIR/<name>/inbox/`).
  Der Agent verarbeitet sie nach demselben Inbox/Outbox-Protokoll wie reguläre
  Nachrichten.

Wenn die Outbox-Reply die Briefing-Frontmatter (`output_kind: briefing`,
`source: cron`, `briefing_title`) enthält, wird sie im **Briefings**-Tab des
Dashboards angezeigt statt im Agent-Chat. Details + Beispiel-Snippets:
[`docs/cron-and-briefings.md`](./cron-and-briefings.md).

## Cron-Requests (Vorschläge / Änderungen)

`cron_requests` ist der Vorschlags-Pfad: Ein User (oder eine Automation)
beantragt das Anlegen, Ändern oder Löschen eines `agent_cron_jobs`-Eintrags.
Die API (`/api/agents/cron-requests`) klassifiziert das Risiko und schiebt
`high` / `critical`-Anträge automatisch in den Risk-Approval-Pfad
([`docs/risk-approval.md`](./risk-approval.md)).

### Agent-driven Vorschlag (`type: cron_request`)

Schreibt der Agent eine Outbox-Reply mit Frontmatter `type: cron_request`,
erkennt die Bridge das in `bridge/src/file-drop.ts` und ruft
`insertCronRequestFromMarker()` aus `bridge/src/cron-requests.ts` auf. Das
landet als `pending`-Zeile in `cron_requests` und (bei `risk_level: high`
oder `critical`) zusätzlich als parallele Zeile in `approvals`. Im Dashboard
erscheint der Vorschlag im Tab **Cron-Vorschlaege**, mit zwei Buttons
(Genehmigen / Ablehnen). Die PATCH-Route
`/api/agents/cron-requests/[id]` führt den Vorschlag bei Genehmigung aus
(legt den Job in `agent_cron_jobs` an, ändert ihn, oder löscht ihn) und
benachrichtigt den Agent über sein Inbox.

Ein Drop-in-Snippet für die Agent-`CLAUDE.md` liegt in
`templates/agent-boilerplate/snippets/cron-request-routine.md`.

## Schemafelder

Spalten und Defaults entstehen in den Migrationen
`000_mana_hub_core.sql`, `20260426_agent_cron_runbooks.sql`,
`20260426_automation_requests_upgrade.sql`. Pro-File-Übersicht in
[`MIGRATIONS.md`](../MIGRATIONS.md).

Weiterführend: [`bridge/README.md`](../bridge/README.md),
[`docs/bridge-modes.md`](./bridge-modes.md).

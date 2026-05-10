---
name: mana-hub-install-helper
description: Guides Mana Hub Core users through a fresh install, Supabase setup, bridge/connector configuration, agent setup, doctor checks, and safe customization. Use when setting up Mana Hub, connecting Supabase, configuring agents or bridges, running fresh-install checks, or adapting the starter to a user's own use case.
---

# Mana Hub Install Helper

## Grundregel

Fuehre Nutzer durch ein blankes Mana-Hub-Core-Setup. Schreibe niemals Secrets in Git-getrackte Dateien. Private Daten, echte Knowledge Base, echte Agent-Pfade und Host-Anpassungen gehoeren in `.env.local`, `user.config/`, `workspace/` oder eigene nicht-Core-Verzeichnisse.

## Setup-Ablauf

0. **Pre-Course Setup Contract zuerst.** Lies `PRE-COURSE-SETUP.md` im Repo-Root. **Teil A** (Minimum vor Lesson 3.1) ist bei echtem Setup vollstaendig abzuarbeiten. **Teil B/C** beschreibt Kurs-Live-Schritte (`~/agents` kopieren, tmux, File-Drop) — die **nicht** fuer den Nutzer vorwegnehmen, wenn er diese Lessons noch aufnehmen oder mit Zuschauern nachbauen will (siehe `docs/course-lesson-boundaries.md`). Die Datei traegt `<!-- MUST_READ_FOR_AGENTS -->` und hat Vorrang vor diesem Skill.

1. Klaere den Modus:
   - Demo: ohne echtes Supabase, nur UI und Beispielstruktur pruefen.
   - Fresh Install: neues Supabase-Projekt, Migrationen, Auth, Storage und lokale Agents einrichten.
   - Existing Host: vorhandenes Projekt anbinden, ohne User Space zu ueberschreiben.

2. Frage gezielt nach:
   - Supabase Project URL.
   - Supabase anon key.
   - Supabase service role key nur fuer `.env.local`.
   - Gewuenschte Agent-Namen und Rollen.
   - Lokaler Agents-Pfad oder Bridge/Runner-Modus.
   - Ob `tmux`, Cron/LaunchAgent oder ein eigener Connector genutzt wird.

3. Leite die Dateien an:
   - `.env.example` nach `.env.local` kopieren und lokal ausfuellen.
   - `user.config/agents.example.json` als Vorlage fuer eigene Agents nutzen.
   - `user.config/connectors.example.json` fuer Bridge/Runner-Details nutzen.
   - `workspace/knowledge.example/` als neutrale Struktur kopieren, aber eigene Inhalte nicht in Core-Dateien speichern.

4. Fuehre die Pruefung:
   - `npm install`
   - Supabase Migrationen aus `supabase/migrations/` in alphabetischer Reihenfolge anwenden.
   - `npm run doctor` (laedt `.env.local` automatisch; harte Checks + **Advisory** fuer tmux/LaunchAgent/s. `docs/course-lesson-boundaries.md`)
   - `npm run lint`
   - `npm run typecheck`
   - Dashboard starten und Smoke Tests aus `docs/fresh-install-checklist.md` ausfuehren.

5. Bridge persistent halten (macOS):
   - Erklaere: die Bridge ist ein dauerhafter Prozess. In Cursor-Terminal stirbt sie beim Schliessen. Fuer echte Nutzung muss sie als LaunchAgent laufen.
   - Frage den Nutzer: "Soll ich die Bridge als macOS LaunchAgent installieren?"
   - Antwort ja: `cd bridge && npm install && npm run launchd:install`. Verifiziere mit `npm run launchd:status` (`state = running`).
   - Antwort nein: weise darauf hin, dass die Bridge dann nur laeuft solange das Cursor-Terminal offen ist.
   - Default-Mode der Bridge ist `inline` (Bridge ruft LLM-API direkt). Fuer das Kurs-Setup ab Modul 3 wird `BRIDGE_MODE=file_drop` benoetigt — frage, ob der Nutzer den Kurs nachbauen will, und setze dann diese Variable plus `BRIDGE_AGENTS_DIR=$HOME/agents` in `bridge/.env`.
   - Siehe `docs/bridge-persistence.md` und `docs/bridge-modes.md`.

6. Agent-Boilerplate-Verzeichnis vorbereiten (Kurs ab Lesson 3.1):
   - **Nur ausfuehren**, wenn der Nutzer **kein** Live-Dreh von Lesson 3.1 plant oder ausdruecklich Hilfe beim Kopieren will.
   - `mkdir -p ~/agents`
   - Frage den Nutzer nach dem Namen seines ersten Agents (Default-Beispiel im Kurs: `taro`).
   - `cp -R templates/agent-boilerplate ~/agents/<agent-name>`
   - Erklaere: die Files in `~/agents/<agent-name>/` sind User Space — der Nutzer fuellt sie in den Lessons 3.2-3.7 selbst.
   - Wenn `BRIDGE_MODE=file_drop` aktiv ist, plus `BRIDGE_AGENT_NAMES` in `bridge/.env` so anpassen, dass es mit dem Agent-Namen matched.
   - Optional: LaunchAgent fuer den Agent installieren mit `bash templates/launchagents/install-agent.sh <agent-name>` (passiert im Kurs in Lesson 3.5).

7. Cron-Briefings einrichten (Kurs Lesson 4.6, optional):
   - **Nur ausfuehren**, wenn der Nutzer fuer einen Agent eine geplante Routine (z.B. taegliches Morgenbriefing) haben will und das nicht selber live nachbauen moechte.
   - Pflichtlektuere zuerst: `docs/cron-and-briefings.md` (End-to-End-Flow, Frontmatter-Kontrakt, Troubleshooting).
   - Schritt 1 — Snippet in CLAUDE.md des Agents ziehen: drei Bloecke aus `templates/agent-boilerplate/snippets/briefing-routine.md` in `~/agents/<agent-name>/CLAUDE.md` einfuegen (Block A als neue §5.8, Block B in §5.2, Block C in §5.3). Jedes `<AGENT_NAME>` durch den lowercase-Agent-Namen ersetzen.
   - Schritt 2 — Cron-Job anlegen: `npm run cron:create -- --agent <name> --id <name>-morning-briefing --name "Morning Briefing" --schedule "07:30" --output-kind briefing --prompt "<task>"`. `--schedule` Minute auf Vielfaches von 5 setzen, sonst `BRIDGE_CRON_TICK_INTERVAL_MS=60000` in `bridge/.env` setzen.
   - Schritt 3 — Verifizieren: `tmux send-keys -t <name> "process_inbox" Enter`, Bridge-Log auf `[file-drop] dispatched reply` pruefen, Dashboard → Briefings-Tab pruefen.
   - Wenn das Briefing im Chat statt im Briefings-Tab landet: der Agent hat einen Pflicht-Frontmatter-Wert (`output_kind`, `source`, `job_id`, `job_name`, `briefing_title`, `category`, `urgency`) vergessen. Quick-Check: `outbox/processed/reply-*.md` mit dem Beispiel im Snippet vergleichen.

8. Risk-Approval einrichten (Kurs Lesson 4.7, optional):
   - **Nur ausfuehren**, wenn der Nutzer Aktionen seines Agents wirklich abnehmen will (Geld, externe Systeme, Loeschen, Vertraege, Posten in seinem Namen). Reine Lese-Agents brauchen das nicht.
   - Pflichtlektuere zuerst: `docs/risk-approval.md` (End-to-End-Flow, action_type-Naming, Always-Policy-Lerneffekt, Troubleshooting).
   - Schritt 1 — Migration applizieren: `supabase/migrations/20260509_approval_policies_learning.sql` im Supabase SQL Editor ausfuehren. Fuegt `use_count`, `last_used_at`, `agent_name`, `source`, `decided_by` und einen Lookup-Index zu `approval_policies` hinzu.
   - Schritt 2 — Snippet in CLAUDE.md des Agents ziehen: zwei Bloecke aus `templates/agent-boilerplate/snippets/risk-approval-routine.md` in `~/agents/<agent-name>/CLAUDE.md` einfuegen (Block A als neue §4.5, Block B in §5.2). Jedes `<AGENT_NAME>` und `<USER_NAME>` ersetzen. Die "Welche Aktionen sind sensibel"-Liste an die Agent-Domaene anpassen.
   - Schritt 3 — Bridge restart, damit die neuen Code-Pfade aktiv sind (`type: approval_request` in Outbox-Reply wird erkannt, `kind: risk_approval_decision` Felder werden ins Inbox-Frontmatter promotet).
   - Schritt 4 — Verifizieren: dem Agent eine sensible Aufgabe schicken (z.B. "verbinde mein Bankkonto"). Pruefen: (a) `outbox/processed/reply-*.md` enthaelt `type: approval_request`, (b) Bridge-Log: `approval ... pending — visible in Risk-Approval tab`, (c) Dashboard `/dashboard/agents/approvals` zeigt eine Karte mit drei Knoepfen, (d) "Einmalig freigeben" → Agent fuehrt aus, (e) "Immer erlauben" beim naechsten Versuch → Always-Policy erscheint im unteren Bereich, (f) dritter Versuch → keine Karte, auto-approved.
   - Wenn die Karte nicht erscheint: Migration nicht appliziert, oder Bridge nicht neugestartet. Wenn der Agent statt eines `type: approval_request`-Replies eine normale Reply schreibt: das §4.5-Snippet fehlt oder `<USER_NAME>`/`<AGENT_NAME>` wurden nicht ersetzt.

## Was Core ist

Core-Dateien sind updatebar: `src/`, `supabase/migrations/`, `docs/`, `.cursor/skills/`, `scripts/`, `.env.example`, `README.md`, `UPGRADE.md`, `SECURITY.md`, `MIGRATIONS.md`.

## Was User Space ist

User Space ist nutzerspezifisch und darf bei Updates nicht ueberschrieben werden: `.env.local`, `user.config/`, `workspace/`, eigene Agent-Verzeichnisse, eigene Bridge-Configs, private Knowledge Base, lokale Logs und nicht-getrackte Secrets.

## Sicherheitsregeln

- Service Role Key nie in Browser-Code, README, Screenshots oder Git schreiben.
- Keine echten Kundendaten, privaten Reports oder persoenlichen Prompts in Demo-Dateien eintragen.
- Bei Unsicherheit erst `npm run doctor` und die Fresh-Install-Checkliste ausfuehren.
- Gefaehrliche Agent-Aktionen ueber Risk Approval oder einen Host-Connector absichern.

## Weitere Referenz

Lies bei Detailfragen [reference.md](reference.md). Nutze die dortigen Checklisten fuer Supabase, Bridge, Agents, Memory, Knowledge Base, MCP, Cron und Permissions.

# Mana Hub Install Helper Reference

## Fresh-Install-Fragen

Nutze diese Fragen, bevor du Dateien aenderst:

- Modus: Demo, Fresh Install oder Existing Host?
- Supabase Project URL vorhanden?
- Supabase anon key vorhanden?
- Supabase service role key vorhanden und nur lokal nutzbar?
- Welche Agents sollen im User Space angelegt werden?
- Welcher Runner wird genutzt: `tmux`, Claude Code, Cursor Agent, eigener Connector oder spaeterer Cloud Runner?
- Sollen Knowledge Base, MCPs, Cron/LaunchAgent und Permissions direkt eingerichtet oder nur vorbereitet werden?

## Dateien und Verantwortlichkeit

Core, updatebar:

- `src/`
- `supabase/migrations/`
- `scripts/doctor.ts`
- `.cursor/skills/`
- `docs/`
- `.env.example`
- `README.md`, `UPGRADE.md`, `SECURITY.md`, `MIGRATIONS.md`

User Space, nicht durch Core-Updates ueberschreiben:

- `.env.local`
- `user.config/`
- `workspace/`
- private Knowledge Base
- lokale Agent-Verzeichnisse
- lokale Bridge-/Runner-Konfigurationen
- Logs, Exporte und Secrets

## Supabase Setup

1. Neues Supabase-Projekt erstellen.
2. SQL aus `supabase/migrations/000_mana_hub_core.sql` ausfuehren.
3. Auth fuer den eigenen Testnutzer einrichten.
4. Storage Bucket fuer Uploads vorbereiten, falls produktive Attachments genutzt werden.
5. `.env.local` lokal befuellen:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MANA_HUB_DEMO_MODE=false
NEXT_PUBLIC_MANA_HUB_DEMO_MODE=false
```

## Bridge und Connector

Standard fuer lokale Kurs-Setups:

- `MANA_HUB_RUNNER=tmux`
- `MANA_HUB_TMUX_BIN=tmux` oder ein systemabhaengiger absoluter Pfad.
- Jede Agent-Session nutzt einen neutralen Agent-Namen aus `user.config/agents.json`.

Alternative:

- Eigener Connector liest neue `agent_messages`.
- Connector ignoriert `metadata.lifecycle_status = retracted`.
- Connector ignoriert superseded messages und nutzt die Message mit `metadata.lifecycle_status = edited`.
- `/api/agents/[id]/stop` muss laufende Arbeit stoppen oder mindestens als Stop-Event erfassen.

## Agent Boilerplate

Ein Agent sollte:

- seinen Namen und Zweck aus `user.config/agents.json` kennen.
- Nachrichten aus `agent_messages` verarbeiten.
- Attachments aus `metadata.attachments` lesen.
- `agent_heartbeats.context_usage_percent` aktualisieren.
- Risk Approval respektieren.
- Stop- und Message-Lifecycle-Metadaten beachten.

## Fresh-Install Smoke Tests

- `npm install` laeuft ohne Fehler.
- `.env.local` existiert lokal, aber ist nicht Git-getrackt.
- Migration ist in Supabase ausgefuehrt.
- `npm run doctor` ist gruen.
- Dashboard startet.
- Demo Login oder eigener Auth-User funktioniert.
- Chat sendet Textnachricht.
- Datei-Upload erzeugt Attachment-Metadaten.
- `/stop` erzeugt ein Stop-Event.
- Message Edit erzeugt eine neue edited message und superseded die alte.
- Workspace Review erstellt eine Agent-Message.
- Outcome-Fortschritt kann aktualisiert werden.
- Knowledge Preview zeigt Markdown-Dateien.

## Lizenzgrenze

Erlaubt:

- private Nutzung.
- interne Business-Nutzung.
- edukative Nutzung im eigenen Setup.
- Anpassung fuer eigene Workflows.

Nicht erlaubt ohne kommerzielle Lizenz:

- Reselling.
- Rebranding als eigenes Template-Produkt.
- SaaS-Angebot als Konkurrenzprodukt.
- Hosting fuer Dritte als Mana-Hub-Alternative.
- Verkauf abgeleiteter Starter-Repositories.

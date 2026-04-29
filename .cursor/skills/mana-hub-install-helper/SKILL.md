---
name: mana-hub-install-helper
description: Guides Mana Hub Core users through a fresh install, Supabase setup, bridge/connector configuration, agent setup, doctor checks, and safe customization. Use when setting up Mana Hub, connecting Supabase, configuring agents or bridges, running fresh-install checks, or adapting the starter to a user's own use case.
---

# Mana Hub Install Helper

## Grundregel

Fuehre Nutzer durch ein blankes Mana-Hub-Core-Setup. Schreibe niemals Secrets in Git-getrackte Dateien. Private Daten, echte Knowledge Base, echte Agent-Pfade und Host-Anpassungen gehoeren in `.env.local`, `user.config/`, `workspace/` oder eigene nicht-Core-Verzeichnisse.

## Setup-Ablauf

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
   - Supabase Migration `supabase/migrations/000_mana_hub_core.sql` anwenden.
   - `npm run doctor`
   - `npm run lint`
   - `npm run typecheck`
   - Dashboard starten und Smoke Tests aus `docs/fresh-install-checklist.md` ausfuehren.

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

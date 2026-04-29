# Mana Hub Starter — Core Product Rules

Diese Datei ist die dauerhafte Arbeitsgrundlage fuer alle Agents, Cursor-Sessions und Claude-Code-Sessions, die an `mana-hub-starter` arbeiten.

## Produktziel

`mana-hub-starter` ist der blanke, installierbare Mana-Hub-Core fuer Kurs, GitHub und Nutzer-Installationen.

Der Core muss so aufgebaut sein, dass Nutzer ihn fuer ihr eigenes Agent-System installieren, konfigurieren und erweitern koennen, ohne private Host-Daten oder personenbezogene Host-Logik zu uebernehmen.

## Nicht verhandelbare Regeln

- Der Core darf keine Verbindung zu einem privaten Host-Backend haben.
- Der Core darf keine echten Host-Daten, Prompts, Knowledge-Base-Inhalte, Reports, Chatlogs, Personen, Kunden, Domains, lokalen Pfade oder privaten Agent-Identitaeten enthalten.
- Demo-Daten muessen vollstaendig synthetisch sein und duerfen nicht an echte Arbeit, echte Kunden, echte Channels, echte Reports oder echte interne Workflows angelehnt sein.
- Alle Secrets bleiben ausschliesslich in `.env.local` oder in Host-Secret-Stores. Keine Secrets in Git, Docs, Seeds, Config-Beispielen oder Generated Files.
- Der Core darf nicht hart an tmux, Claude Code, Supabase Service Role, private Host-Navigation, private Avatare oder lokale `/Users/...` Pfade gekoppelt sein. Solche Dinge gehoeren in Host Adapter oder Beispiele.

## Core vs User Space

Der Core ist updatebar. Nutzer sollen Updates einspielen koennen, ohne ihre eigenen Anpassungen zu verlieren.

### Updatebarer Core

- `src/`
- `supabase/migrations/`
- `docs/`
- `scripts/`
- `.cursor/skills/`
- Beispiel-Config-Dateien wie `user.config/*.example.json`
- Beispiel-Workspace-Dateien wie `workspace/**/*.example.*`

### User Space

Diese Bereiche sind fuer Nutzeranpassungen gedacht und duerfen von Core-Updates nicht ueberschrieben werden:

- `.env.local`
- echte Dateien in `user.config/`
- echte Dateien in `workspace/`
- eigene Agent-Verzeichnisse
- eigene Knowledge Base
- eigene Bridge-/Connector-Konfiguration
- eigene MCP-, LaunchAgent-, tmux- oder Runner-Konfiguration

Wenn neue Features User Space brauchen, immer ueber additive Beispiele, Migrationen oder klare Upgrade-Schritte arbeiten. Keine stillen Breaking Changes.

## Install Helper Skill

Der Starter muss einen Projekt-Skill enthalten, der Nutzer beim Setup fuehrt:

- Supabase-Projekt verbinden
- `.env.local` sicher anlegen
- Migrationen ausfuehren oder erklaeren
- Demo-/Production-Modus unterscheiden
- Agent-Boilerplate erstellen
- Bridge oder Connector konfigurieren
- `npm run doctor` und Smoke Checks ausfuehren
- erklaeren, welche Dateien Core sind und welche der Nutzer anpassen darf

Der Skill darf keine privaten Annahmen ueber ein konkretes Host-Projekt treffen.

## Lizenzgrenze

Nutzer duerfen Mana Hub fuer eigene, interne, edukative und Business-Zwecke verwenden.

Nicht erlaubt ohne kommerzielle Lizenz:

- Reselling
- Rebranding als eigenes Produkt
- Weiterverkauf als Template
- Hosting als SaaS oder Managed Service
- Verkauf einer konkurrierenden Plattform auf Basis des Mana Hub Core

## GitHub-Readiness

Vor jedem Public/GitHub-Schritt pruefen:

- Secret Scan
- Suche nach privaten Host-Namen, echten Namen, echten Domains, echten E-Mails und `/Users/`
- keine echten Prompt-, Knowledge-, Report-, Task- oder Chatdaten
- Fresh Install in leerem Ordner
- frisches Supabase-Projekt mit blanken Demo-Daten
- `npm run doctor`
- Lint, TypeScript, Build und Smoke Checks

Wenn eine Aenderung diese Regeln verletzt, nicht implementieren. Erst Core/Host-Grenze neu ziehen.

# Agent Boilerplate

> **Kurs-Aufnahme:** Den Ordner `~/agents/<name>/` legst du **typischerweise in Lesson 3.1** gemeinsam mit den Zuschauern an (`mkdir`, `cp -R`). Vorher nur sicherstellen, dass dieses Template im Repo unter `templates/agent-boilerplate/` existiert (Teil A von `PRE-COURSE-SETUP.md`). Nicht das Template im Core ueberschreiben — immer **kopieren**.

Kopierbare Skelett-Struktur fuer einen neuen Mana-Hub-Agent. Wird in Modul 3.1 des Kurses nach `~/agents/<agent-name>/` kopiert.

## Was ist drin

| File | Zweck |
|---|---|
| `CLAUDE.md` | Master Manual: Identitaet, Verhalten, Routing, Memory-Lade-Block, Inbox/Outbox-Protokoll |
| `MEMORY.md` | Langzeitgedaechtnis: Firma, Stil, Praeferenzen — wird vom Agent bei jedem Start gelesen |
| `CURRENT.md` | Sprint-Status, aktive Tasks, Deadlines diese Woche |
| `.mcp.json` | MCP-Server-Konfiguration (anfangs leer, wird in Modul 3.7 + 4.3 befuellt) |
| `.claude/settings.json` | Permissions: was darf der Agent. Default-Allow: Bash, Read, Write, Edit, WebFetch, MCP-Tools. Default-Deny: `~/.ssh/**`, `/etc/**` (+ `/private/etc/**`), Shell-Configs (`.zshrc`, `.zshenv`, `.zprofile`, `.bashrc`, `.bash_profile`). |
| `inbox/` | Bridge schreibt hier Nachrichten als `msg-<TS>-<id>.md` (File-Drop-Mode) |
| `outbox/` | Agent schreibt hier Antworten als `reply-<TS>-<id>.md` (File-Drop-Mode) |
| `memory/` | Themen-spezifische Memory-Files (decisions.md, goals.md, contacts.md, ...) |
| `snippets/` | Optionale Copy-paste-Bloecke fuer `CLAUDE.md` (z.B. Cron-Briefing-Routine). Das Boilerplate selbst bleibt leer — Snippets ziehst du nur rein, wenn du das Feature aktivierst. |
| `.env.example` | Vorlage fuer per-Agent-Secrets (MCP-Keys etc.). Kopiere zu `.env` und fuelle die Werte deines Agents ein. **Nicht committen.** |
| `start.sh.example` | Wrapper-Script fuer tmux/LaunchAgent-Boot. Laedt `.env`, ruft `caffeinate -i claude --dangerously-skip-permissions` auf. Kopiere zu `start.sh` und mach es ausfuehrbar (`chmod +x start.sh`). |
| `MCP-EXAMPLES.md` | Drop-in-Bloecke fuer `.mcp.json`: Perplexity, Playwright, Context7, YouTube, Filesystem, Slack. |

## Verwendung

Wird im Kurs Lesson 3.1 mit Cursor-Prompt kopiert:

```bash
cp -R templates/agent-boilerplate ~/agents/<your-agent-name>
```

Anschliessend in den Lessons 3.2-3.5 befuellt:

- `CLAUDE.md` mit echter Identitaet (Lesson 3.2)
- Memory-Lade-Block bestaetigen (Lesson 3.3)
- `MEMORY.md` mit User-Daten befuellen (Lesson 3.3)
- Persistente tmux-Session starten (Lesson 3.4)
- LaunchAgent fuer Auto-Start einrichten (Lesson 3.5) — siehe `templates/launchagents/`

In Modul 4 dann optional erweitert:

- Permissions absichern (`.claude/settings.json`, Lesson 4.5) — Defaults sind bereits scharf gesetzt
- Cron-Briefings aktivieren (Lesson 4.6) — Snippet aus `snippets/briefing-routine.md` in `CLAUDE.md` ziehen, Job mit `npm run cron:create` anlegen. Vollstaendige Spec: `docs/cron-and-briefings.md`

## Wichtig

- Die Boilerplate ist **leer** — du musst sie befuellen. Im Kurs macht das Cursor fuer dich.
- Sensible Daten (API-Keys) gehoeren NIEMALS in `MEMORY.md`, `CLAUDE.md`, `.mcp.json` oder Outbox-Replies. Nutze stattdessen `~/agents/<name>/.env` + `start.sh` (siehe `docs/agent-setup.md` Section 3.7 / 4.5). Die Default-`deny`-Regeln blockieren bereits Lese-/Schreibzugriff auf `~/.zshrc` & Co., damit eine versehentliche Eskalation ueber Shell-RC-Dateien ausgeschlossen ist.
- Die Boilerplate ist Update-safe Core. Wenn du Mana Hub updatest, aendert sich die Boilerplate, aber dein eigener `~/agents/<name>/` Ordner bleibt unangetastet.

## Permissions anpassen

Wenn dein Agent doch eine der Deny-Pfade braucht (z.B. ein Recherche-Agent, der `/etc/hosts` lesen darf), entferne die entsprechende Zeile **nur in deinem User Space** (`~/agents/<name>/.claude/settings.json`), nicht in dieser Boilerplate. So bleibt das Default-Sicherheitsnetz fuer neue Agents erhalten.

**Hinweis zu `--dangerously-skip-permissions`:** Wenn du Claude Code mit diesem Flag startest (z.B. via `start.sh` / LaunchAgent fuer 24/7-Betrieb), greifen interaktive Permission-Prompts nicht mehr. Die `deny`-Regeln aus `settings.json` bleiben aber als harte Sperre aktiv — Claude Code lehnt die Operation in dem Fall lautlos ab.

<!-- MUST_READ_FOR_AGENTS -->

# Pre-Course Setup Contract

> **Verpflichtend lesen.** Wenn du eine AI bist (Cursor, Claude Code, der Mana Hub Install Helper Skill) und Setup begleitest: lies diese Datei zuerst. Wenn du ein Mensch bist: das ist deine technische Sicherheitsnetz-Checkliste.
>
> **Wichtig für Kurs-Aufnahme:** Nicht alles hier muss erledigt sein, *bevor* du **Lesson 3.1** live mit Zuschauern drehst. Es gibt **Teil A** (Basis im Repo / Env — ja, vor 3.1) und **Teil B/C** (Schritte aus Modul 3 — teils **gemeinsam mit Zuschauern**, nicht vorweg automatisieren). Details: `docs/course-lesson-boundaries.md`.

---

## Was du vor Lesson 3.1 NICHT tun solltest (nicht vorwegnehmen)

Wenn du Lesson 3.1 noch aufnehmen willst, führe diese Schritte **nicht** schon alleine aus — die gehören typischerweise **live in den Lessons**:

- `mkdir -p ~/agents` **und** `cp -R templates/agent-boilerplate ~/agents/<name>` — **Lesson 3.1**
- `brew install tmux`, erste Claude-Code-Session in tmux — ab **Lesson 3.4** (laut Standard-Skript)
- `bash templates/launchagents/install-agent.sh …` — **Lesson 3.5**
- `BRIDGE_MODE=file_drop` setzen und File-Drop-Roundtrip testen — **Lesson 3.6** (wenn dein Skript den Wechsel dort zeigt)
- Knowledge-Base-Verzeichnis befüllen / Symlink — **Modul 4**

Das Repo-Template unter `templates/agent-boilerplate/` muss **im Core vorhanden** sein — das ist **kein** User-Space-Kopieren, nur die Quelle.

---

## Teil 0 — System-Voraussetzungen (vor Teil A)

Diese Sachen müssen **auf dem Mac selbst** sitzen, **bevor** du das Repo überhaupt sinnvoll initialisieren kannst. Ist das nicht da, scheiterst du in Teil A oder spätestens in Lesson 3.4.

### macOS

| Tool | Wozu | Wann wirklich gebraucht | Install (einmal) |
| --- | --- | --- | --- |
| **Xcode Command Line Tools** | git, compiler — Voraussetzung für brew | sofort | `xcode-select --install` |
| **Homebrew** | Paketmanager für tmux, ggf. node | spätestens Lesson 3.4 | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` — fragt einmal nach deinem Mac-Passwort, läuft 3–5 Min |
| **Stable Node ≥ 20** außerhalb von Cursor | Repo-Install (`npm install`), Bridge, Doctor, später LaunchAgents | sofort | `brew install node` ODER pnpm/nvm — wichtig: **nicht** der Cursor-interne Node aus `/Applications/Cursor.app/...` |
| **Claude Code CLI** | Dein lokaler Agent läuft als `claude` REPL | ab Lesson 3.4 | `npm install -g @anthropic-ai/claude-code` — siehe Hinweis unten zu PATH |
| **tmux** | Persistente Agent-Sessions | ab Lesson 3.4 | `brew install tmux` — kann live in der Lesson, **nicht** vorwegnehmen wenn du Lesson 3.4 noch aufnimmst |

### Nach `brew install` (egal was) — PATH einmalig in `~/.zshrc` aktivieren

Wenn brew frisch installiert ist und `which brew` leer bleibt in neuen Shells:

```bash
echo '' >> ~/.zshrc
echo '# Homebrew' >> ~/.zshrc
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc
```

### Nach `npm install -g @anthropic-ai/claude-code` — PATH-Check für `claude`

`npm` legt globale Binaries je nach Setup unter unterschiedliche Pfade. Standard-Check:

```bash
which claude
```

**Wenn leer**, häufigster Fall bei pnpm-managed Node:

```bash
echo 'export PATH="$PNPM_HOME/nodejs_current/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
which claude   # jetzt sollte ein Pfad kommen
```

Bei nvm: `nvm which current` zeigt den Node-Pfad — daneben gibt es einen `bin/`-Ordner mit `claude`.

### Erstmaliger Start von Claude Code: zwei Sicherheits-Prompts

Beim **allerersten** `claude` in einem neuen Verzeichnis (z.B. `~/agents/<name>/`) zeigt Claude Code zwei interaktive Dialoge:

1. **"Is this a project you trust?"** → `1. Yes, I trust this folder` (Default — **Enter** genügt).
2. **"WARNING: Claude Code running in Bypass Permissions mode"** → `2. Yes, I accept` (Default ist **No, exit** — du musst aktiv `2` + **Enter** drücken).

**Wichtig:** Diese Dialoge tauchen pro Verzeichnis **einmal** auf. Wenn du Claude Code später automatisiert (LaunchAgent, tmux send-keys aus Bridge) startest, müssen diese Dialoge schon einmal manuell durchgeklickt sein — sonst hängt der automatisierte Start.

**Empfehlung:** Bevor du LaunchAgents in Lesson 3.5 anlegst, einmal manuell:

```bash
cd ~/agents/<name>
claude --dangerously-skip-permissions
# Beide Dialoge bestätigen, dann mit /quit oder Ctrl+C beenden
```

---

## Teil A — Minimum vor Lesson 3.1 (Basis, Core bereit)

Diese Punkte sollten **vor** dem Live-Start von Lesson 3.1 erfüllt sein, damit nichts Technisches dazwischenfunkt:

1. **Supabase-Projekt** steht, **alle** SQL-Dateien aus `supabase/migrations/` sind in alphabetischer Reihenfolge angewendet.
2. **`NEXT_PUBLIC_SUPABASE_URL`** in `.env.local` ist die **Basis-URL ohne** `/rest/v1/`.
3. **Keys gemappt:** `sb_publishable_…` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `sb_secret_…` → `SUPABASE_SERVICE_ROLE_KEY` (siehe Tabelle unten).
4. **Root-`.env.local`** vollständig (Port `NEXT_PUBLIC_APP_URL` = tatsächlicher Next-Port).
5. **`bridge/.env`** existiert, `SUPABASE_URL` ohne `/rest/v1/`, `SUPABASE_SECRET_KEY` gesetzt. Für die erste Lesson reicht **`BRIDGE_MODE=inline`** (Default in `bridge/.env.example`) — **nicht** auf `file_drop` wechseln, bevor du das im Kurs zeigst.
6. **`cd bridge && npm install`** und `npx tsc --noEmit` im Ordner `bridge/` ohne Fehler.
7. **Im Repo-Root:** `npm install`, **`npm run doctor`** — alle **harten** Checks grün (siehe unten zu „Doctor“).
8. **`npm run dev`** startet das Dashboard ohne Crash; `/login` oder Demo-Zugang funktioniert.

**Optional vor 3.1 (technisch hilfreich, aber Kurs-Live optional):** Bridge manuell testen (`cd bridge && npm start` oder LaunchAgent aus Teil B), **nur** im **inline**-Echo-Modus, damit du weißt, dass Nachrichten laufen — nicht nötig, wenn du den Chat erst **nach** 3.1 zeigst.

### Key-Mapping (Referenz)

| Supabase UI | `.env.local` | `bridge/.env` |
| --- | --- | --- |
| Publishable `sb_publishable_…` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — |
| Secret `sb_secret_…` | `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SECRET_KEY` |

---

## Teil B — Lesson 3.1 (mit Zuschauern — hier nicht vorweg automatisieren)

Typischer Ablauf im Kurs:

```bash
mkdir -p ~/agents
cp -R templates/agent-boilerplate ~/agents/<dein-agent-name>
```

Anschließend Dateien **im kopierten Ordner** bearbeiten (nicht im `templates/`-Original). Details: `templates/agent-boilerplate/README.md`.

---

## Teil C — Ab späteren Lessons (Modul 3, nicht vor 3.1 nötig)

| Thema | Übliche Lesson (Orientierung) | Kurz |
| --- | --- | --- |
| tmux installieren / Claude Code in Session | ca. 3.4 | `docs/agent-setup.md` |
| Agent-LaunchAgent (`templates/launchagents/`) | ca. 3.5 | `templates/launchagents/README.md` |
| `BRIDGE_MODE=file_drop`, Inbox/Outbox | ca. 3.6 | `docs/bridge-modes.md` |
| Bridge dauerhaft (LaunchAgent + `caffeinate`) | wenn du 24/7-Chat brauchst | `docs/bridge-persistence.md`, `bridge/launchd/README.md` |
| MCP, Permissions vertiefen | 3.7 / 4.5 | Boilerplate + Doku |

---

## Teil D — Volle Betriebsbereitschaft (Echo-Chat + Bridge dauerhaft)

Wenn du **nicht** nur Lesson 3.1, sondern den **gesamten** Modul-3-Pfad inkl. Dashboard-Chat und permanenter Bridge abdecken willst, kommen **zusätzlich** zu Teil A noch:

- **Bridge als LaunchAgent:** `cd bridge && npm run launchd:install`, dann `npm run launchd:status` → `state = running`.
- **macOS:** `tmux` installiert (`brew install tmux`), stabiler Node außerhalb von Cursor (brew/pnpm/nvm), `claude --version`.
- **Smoke:** Im Dashboard Nachricht an den konfigurierten Agent (z. B. `orchestrator`); Echo-Antwort im **inline**-Modus; Logs unter `bridge/launchd/logs.sh`.

Das ist **nicht** Voraussetzung für den **ordneranlegenden** Teil von Lesson 3.1.

---

## Doctor (`npm run doctor`)

- Lädt `.env.local` automatisch.
- **Harte Fehler:** fehlende Core-Dateien, falsche URL, fehlende Templates, fehlende `bridge/.env` bei echtem Install, usw.
- **Hinweise (Warnung, kein Exit-Code-Fail):** z. B. tmux / Bridge-LaunchAgent / stabiler Node — damit du **Lesson 3.1** nicht blockierst, wenn du tmux erst in Lesson 3.4 installierst.

---

## Für AI-Agents

1. Lies diese Datei zu Beginn der Setup-Session.
2. Erledige **Teil A** vollständig, bevor du Infrastructure für **Teil B/C** vornimmst.
3. **Tu nicht** Lesson-3.1-Schritte (`cp` nach `~/agents`, Agent-Namen wählen) für den Nutzer, wenn er ausdrücklich eine **Live-Lesson** vorbereitet — verweise auf die Lesson.
4. **`PRE-COURSE-SETUP.md` hat Vorrang** vor reinen Skill-Heuristiken; Details im Skill `mana-hub-install-helper`.

Änderungen an dieser Datei bei neuen Footguns auch in `_course-prep/CORE-IMPROVEMENTS.md` festhalten (lokal, gitignored).

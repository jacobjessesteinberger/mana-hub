# Agent Setup (Course Module 3)

> **Lesson-Reihenfolge:** Was du **vor** Lesson 3.1 im Repo brauchst vs. was **live** in den Lessons passiert, steht in [`course-lesson-boundaries.md`](./course-lesson-boundaries.md). Lesson 3.1 ist u. a. das **Kopieren** der Boilerplate nach `~/agents/<name>/` — nicht vorher im Setup-Agent ausführen, wenn du es mit Zuschauern drehst.

Conceptual overview of how a Mana Hub Agent gets created from the boilerplate to a fully running persistent process. Follows the structure of Course Module 3 (Lessons 3.1 - 3.7).

## Mental Model

```
templates/agent-boilerplate/   (Core, in repo)
        |
        | cp -R
        v
~/agents/<agent-name>/         (User Space, gitignored elsewhere)
        |
        |  + CLAUDE.md identity
        |  + MEMORY.md long-term knowledge
        |  + CURRENT.md sprint state
        |  + .mcp.json with tools
        |
        v
tmux session "<agent-name>"   (started by templates/launchagents/install-agent.sh)
        |
        | runs: caffeinate -i claude --dangerously-skip-permissions
        |
        v
Claude Code REPL              (reads inbox/, writes outbox/)
```

Plus, in parallel:

```
Mana Hub Bridge               (long-running Node process, file_drop mode)
        |
        | watches Supabase agent_messages for new user rows
        | writes msg-*.md to ~/agents/<name>/inbox/
        | watches ~/agents/<name>/outbox/ for reply-*.md
        | syncs replies back to agent_messages
```

## Files in `templates/agent-boilerplate/`

| File | Course Lesson | Purpose |
|---|---|---|
| `CLAUDE.md` | 3.2 | Identity, communication style, responsibilities, boundaries, memory loading rules, inbox/outbox protocol |
| `MEMORY.md` | 3.3 | Long-term facts about user, company, preferences |
| `CURRENT.md` | 3.3 | Sprint, active tasks, this week |
| `.mcp.json` | 3.7 | MCP server tools (Perplexity, Playwright, Context7, ...) |
| `.claude/settings.json` | 4.5 | Permissions: what the agent may execute |
| `inbox/` | 3.6 | Bridge writes user messages here |
| `outbox/` | 3.6 | Agent writes replies here |
| `memory/` | (later) | Topic-specific memory files (decisions.md, contacts.md, ...) |

## Steps in Module 3

### 3.1 Create Agent Directory

```bash
cp -R templates/agent-boilerplate ~/agents/<agent-name>
```

Course default agent name: `orchestrator`. User can pick anything lowercase.

### 3.2 Write `CLAUDE.md` Identity

Replace the placeholders in `CLAUDE.md` sections 1-4 with concrete identity, style, responsibilities, and limits. The Memory-Lade-Block (section 5) and Inbox-Outbox-Protokoll (section 6) are pre-filled and should stay.

### 3.3 Verify Memory System

Fill in `MEMORY.md` and `CURRENT.md` with real values. Restart Claude Code and confirm it reads them at startup ("Was weisst du ueber mich?").

### 3.4 Persistent tmux Session

```bash
tmux new-session -d -s <agent-name> -c ~/agents/<agent-name> "claude --dangerously-skip-permissions"
```

This is what `templates/launchagents/install-agent.sh` automates.

### 3.5 LaunchAgent for 24/7

```bash
bash templates/launchagents/install-agent.sh <agent-name>
```

Installs an `ai.claude.<agent-name>` LaunchAgent that auto-starts at login and restarts on crash. See `templates/launchagents/README.md`.

### 3.6 First Real Conversation

Requires:

- Bridge running in `BRIDGE_MODE=file_drop` (see `docs/bridge-modes.md`)
- `BRIDGE_AGENT_NAMES` includes this agent
- Agent's tmux session is up (verified with `npm run launchd:status` from `templates/launchagents/`)

Send a message in the dashboard. Bridge writes `msg-*.md` to `inbox/`, Claude Code processes it, writes `reply-*.md` to `outbox/`, Bridge syncs back.

### 3.7 First MCP Tool

Edit `~/agents/<agent-name>/.mcp.json` to add an MCP server (e.g. Perplexity). API keys belong in `~/agents/<agent-name>/.env` (loaded by `start.sh` before Claude Code starts), referenced from `.mcp.json` via `${VAR_NAME}`. Never hardcode keys into `.mcp.json` (would be re-read on every session, easy to leak via git/backups). Restart the session afterwards.

## Module 4 — Hardening & Operations

### 4.5 Permissions (`.claude/settings.json`)

The boilerplate ships with a balanced default in `~/agents/<agent-name>/.claude/settings.json`:

- **`allow`:** `Bash(*)`, `Read(*)`, `Write(*)`, `Edit(*)`, `WebFetch(*)`, `mcp__*` — the agent can do its day-to-day work without asking.
- **`deny`:** sensitive locations are hard-blocked. The defaults cover:
  - `~/.ssh/**` (SSH keys, known_hosts, config)
  - `/etc/**` and `/private/etc/**` (macOS system configuration, includes `/etc/ssh`, `/etc/hosts`, `/etc/sudoers`, etc.)
  - shell startup files (`~/.zshrc`, `~/.zshenv`, `~/.zprofile`, `~/.bashrc`, `~/.bash_profile`)

#### When to extend `deny`

Add per-agent paths to your **own** `~/agents/<agent-name>/.claude/settings.json` (not to the boilerplate, which would affect every future agent). Common additions for production agents:

```json
"Read(~/.aws/**)", "Write(~/.aws/**)", "Edit(~/.aws/**)",
"Read(~/.gnupg/**)", "Write(~/.gnupg/**)", "Edit(~/.gnupg/**)",
"Read(~/.config/gcloud/**)", "Write(~/.config/gcloud/**)", "Edit(~/.config/gcloud/**)",
"Read(~/.npmrc)", "Write(~/.npmrc)", "Edit(~/.npmrc)"
```

#### `--dangerously-skip-permissions` and `deny`

The `start.sh` wrapper and the LaunchAgent template both launch Claude Code with `--dangerously-skip-permissions` so that no interactive prompt blocks a 24/7 session. This flag skips **prompts**, not the **`deny` rules** — denied paths remain hard-blocked. If you want the deny list to be optional ("ask, don't block"), drop the flag and the agent will prompt instead.

#### Where this is used in the course

Lesson 4.5 walks through editing `.claude/settings.json` live. The boilerplate version is already safe to ship, so users who skip the lesson are still protected by the defaults.

### 4.6 Cron-Briefings (daily morning briefing & similar routines)

The Mana Hub dashboard has a dedicated **Briefings** tab at `/dashboard/agents/briefings`. Anything an agent produces on a schedule (morning briefing, AI-news scan, finance summary) should land there instead of the regular chat. Getting that right requires three small pieces working together.

Full reference: **[`docs/cron-and-briefings.md`](./cron-and-briefings.md)**.

#### Step 1 — Add the briefing routine to your agent's `CLAUDE.md`

Open `templates/agent-boilerplate/snippets/briefing-routine.md`. It contains three drop-in blocks:

- **Block A** → new `§5.8 Cron-Briefings` section (full body format, frontmatter contract, urgency levels, example reply)
- **Block B** → one paragraph patch into `§5.2 Inbox` (recognises briefing inbox files)
- **Block C** → one bullet patch into `§5.3 Outbox` (mandatory YAML fields)

Copy each block into `~/agents/<agent-name>/CLAUDE.md` and replace `<AGENT_NAME>` with your agent's lowercase name.

#### Step 2 — Create the cron job in Supabase

```bash
npm run cron:create -- \
  --agent <agent-name> \
  --id <agent-name>-morning-briefing \
  --name "Morning Briefing" \
  --schedule "07:30" \
  --output-kind briefing \
  --prompt "Schreib mir das taegliche Morgenbriefing nach §5.8."
```

Notes:

- `--schedule` minute should be a multiple of 5 (default bridge tick is 5 min). Otherwise set `BRIDGE_CRON_TICK_INTERVAL_MS=60000` in `bridge/.env`.
- `--output-kind briefing` is the magic word — without it the row stays an `output_kind: cron` and the agent reply will not be classified as a briefing.
- Re-running the same `--id` updates the row (UPSERT).
- `npm run cron:create -- --list` shows existing jobs. `npm run cron:create -- --id <id> --delete` removes one.

#### Step 3 — Verify it actually appears in the Briefings tab

```bash
tmux send-keys -t <agent-name> "process_inbox" Enter
```

(or wait for the schedule). Then:

1. `tmux attach -t <agent-name>` — confirm the agent reads `inbox/cron-*.md` and writes `outbox/reply-*.md`.
2. Check the bridge log for `[file-drop] dispatched reply`.
3. Open the dashboard → **Briefings** tab → the new briefing appears in its category column.

If it lands in the regular chat instead, the agent dropped one of the mandatory YAML fields. Inspect `outbox/processed/reply-*.md` and compare against the snippet.

#### Why the snippet is not pre-baked into the boilerplate

The boilerplate `CLAUDE.md` is intentionally a stub the user fills in during Module 3 lessons. Pre-loading `§5.8` would (a) confuse Module 3 ("there's already content I haven't been taught about?") and (b) hardcode briefing-specific assumptions (Wetter / Heute anstehend / Mein Vorschlag) that not every agent wants. The snippet model lets each agent opt in with the right body shape for its job.

### 4.7 Risk-Approval (sensible Aktionen mit menschlicher Freigabe)

Sobald ein Agent Geld bewegt, externe Systeme verbindet, Daten loescht oder im Namen des Users mit Dritten kommuniziert, soll er **nicht direkt ausfuehren**, sondern **eine Approval anfordern**. Die Approval erscheint im Mana Hub unter `/dashboard/agents/approvals` mit drei Knoepfen:

- **Ablehnen** — Aktion wird nicht ausgefuehrt
- **Einmalig freigeben** — diese eine Anfrage ok, beim naechsten Mal wieder fragen
- **Immer erlauben** — diese Anfrage ok UND eine Always-Policy speichern, sodass alle zukuenftigen Anfragen mit gleicher `action_type` ohne Nachfrage durchlaufen (Lerneffekt)

Volle Spezifikation: **[`docs/risk-approval.md`](./risk-approval.md)**.

#### Step 1 — Migration applizieren (einmalig pro Projekt)

```sql
-- Im Supabase SQL Editor ausfuehren:
-- supabase/migrations/20260509_approval_policies_learning.sql
```

Fuegt die Lerncolumns (`use_count`, `last_used_at`, `agent_name`, `source`, `decided_by`) und einen Lookup-Index zu `approval_policies` hinzu.

#### Step 2 — Risk-Approval-Snippet in CLAUDE.md des Agents einfuegen

Oeffne `templates/agent-boilerplate/snippets/risk-approval-routine.md`. Es enthaelt zwei Bloecke:

- **Block A** → neuer `§4.5 Risk-Approval-Protokoll` Abschnitt (Kategorien sensibler Aktionen, Outbox-Format, Pending-State-Verwaltung)
- **Block B** → ein-Absatz-Patch in `§5.2 Inbox` (erkennt `kind: risk_approval_decision` Inbox-Files)

Kopiere beide Bloecke in `~/agents/<agent-name>/CLAUDE.md` und ersetze `<USER_NAME>` mit deinem Namen sowie `<AGENT_NAME>` mit dem Agent-Namen.

Passe die "Welche Aktionen sind sensibel"-Liste an die Domaene deines Agents an (z.B. ein Marketing-Agent braucht `social.youtube.publish`, ein Buchhaltungs-Agent `finance.invoice.send`).

#### Step 3 — Bridge restart

Die Bridge-Aenderungen (Erkennung von `type: approval_request` in Outbox-Replies, Promotion der Approval-Felder ins Inbox-Frontmatter) sind im Core ab dieser Migration aktiv. Wenn die Bridge gerade laeuft, einmal neustarten:

```bash
# in deinem bridge-tmux oder LaunchAgent
tmux send-keys -t bridge C-c
# warte 2 sec
cd bridge && npm run dev
```

#### Step 4 — Verify it actually works

Sende dem Agent eine sensible Aufgabe, z.B. "verbinde mein Bankkonto":

1. **Pruefe**: `~/agents/<name>/outbox/processed/reply-*.md` enthaelt `type: approval_request` und alle Approval-Felder.
2. **Pruefe**: Bridge-Log enthaelt `[file-drop] approval ... pending — visible in Risk-Approval tab`.
3. **Pruefe**: Dashboard `/dashboard/agents/approvals` zeigt eine Karte mit drei Knoepfen.
4. **Klick** auf "Einmalig freigeben" → der Agent bekommt innerhalb von Sekunden eine Decision-Inbox-Message und reagiert mit der Ausfuehrung.
5. **Wiederhole** die gleiche Aufgabe → wieder eine Karte (one-shot, keine Policy gespeichert).
6. **Klick** "Immer erlauben" → Agent reagiert wie in 4, AND in der unteren Sektion erscheint die neue Always-Policy.
7. **Wiederhole** ein drittes Mal → **keine Karte**, der Agent bekommt sofort eine auto-approved Decision-Message. Bridge-Log: `auto-approved by policy <id>`.

Wenn Schritt 3 nichts zeigt: Migration nicht appliziert, oder die Bridge wurde nach dem Code-Update nicht neugestartet.

#### Was Approval **nicht** abdeckt

- Permission-Prompts von Claude Code selbst (z.B. "darf ich diese Datei lesen") — die werden durch `--dangerously-skip-permissions` in `start.sh` ausgehebelt. Wenn du sie zurueckwillst, das Flag entfernen — Claude wird dann in der tmux-Session interaktiv fragen und die `/api/agents/approve` Route (separater Pfad, sendet `1`/`2`/`3`-Tasten) wird wieder relevant. Aber: 24/7-Agent + interaktive Prompts vertragen sich schlecht.
- Filesystem-`deny`-Regeln aus `.claude/settings.json` (Section 4.5). Die sind **harte Sperren**, sie sind unabhaengig von Risk-Approval. Approval ist freiwillig — der Agent kann es umgehen, wenn die CLAUDE.md-Regel nicht da ist. `deny` kann er nicht umgehen.

## What is User Space

`~/agents/<agent-name>/` is User Space. It is **not** part of the Mana Hub Core. When you upgrade Mana Hub, this directory stays untouched. The `templates/agent-boilerplate/` template **may** change in updates — re-copy specific files manually if you want the new defaults.

## Troubleshooting

- **Agent doesn't see new inbox files:** Check `BRIDGE_MODE=file_drop` in `bridge/.env`, and that `BRIDGE_AGENT_NAMES` includes this agent.
- **Bridge writes inbox but agent doesn't react:** Check tmux session: `tmux has-session -t <agent-name>`. If down, run `bash templates/launchagents/status-agent.sh <agent-name>`.
- **Replies don't appear in dashboard:** Verify outbox files have correct YAML front matter (`reply_to_id`, `created_at`). The bridge silently rejects malformed files — see bridge logs.
- **Two replies for one message:** You probably have two bridges running (e.g. one in Cursor terminal, one as LaunchAgent). Run `pkill -f 'tsx src/index.ts'` and re-check.

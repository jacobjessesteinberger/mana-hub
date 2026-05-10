---
name: mana-hub-speedrun
description: Bonus 30-minute speedrun setup for experienced Mana Hub users. Skips the deep explanations and runs the smallest set of steps from clone to a running dashboard with one local agent. Use when the user explicitly asks for a speedrun, fast track, or "I already know what Mana Hub is, just get me up".
---

# Mana Hub — 30-Minute Speedrun

> **For experienced users.** If you have never set up Mana Hub before, use the
> `mana-hub-install-helper` skill instead — it walks you through every
> decision. This skill assumes you already know what Supabase, tmux, and
> Claude Code are.

## Goal

In 30 minutes, end with:

- the dashboard running on `http://localhost:3000`
- a Supabase project with all migrations applied
- one local agent that the dashboard can chat with
- the Bridge running locally (no LaunchAgent yet)
- `npm run doctor` exiting 0

Persistence (LaunchAgent), knowledge base, cron briefings, multi-agent setup,
risk-approval policies, and Web-Push are **out of scope** here. Add them
afterwards from `docs/`.

## Prerequisites (do these before starting the timer)

- Node ≥ 20.10 (`node -v`)
- A Supabase account with **one empty project** ready (free tier is fine)
- Claude Code CLI installed (`claude --version`) and logged in
- The user knows where they want their agent folder
  (e.g. `~/agents/<name>/`, default `~/agents/mana/`)

## The 7 steps (≈ 4 min each)

### 1. Clone + install (≈ 2 min)

```bash
git clone https://github.com/jesse-media/mana-hub.git mana-hub
cd mana-hub
cp .env.example .env.local
npm install
```

### 2. Wire Supabase (≈ 4 min)

In Supabase Dashboard → Project Settings → API, copy:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `sb_publishable_…` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `sb_secret_…` → `SUPABASE_SERVICE_ROLE_KEY`

Open `.env.local` and paste them in. Set `MANA_HUB_DEMO_MODE=false` and
`NEXT_PUBLIC_MANA_HUB_DEMO_MODE=false`. Set `ADMIN_EMAIL` to the email you
want to log in with.

### 3. Run all migrations (≈ 4 min)

In Supabase SQL editor, paste each file from `supabase/migrations/`
**in alphabetical order** and run it. Every file is idempotent — re-running
is safe. There are 13 files; takes about 2 minutes if you batch them.

### 4. Doctor + dev (≈ 2 min)

```bash
npm run doctor   # must exit 0
npm run dev      # starts http://localhost:3000
```

Open <http://localhost:3000/login>, request a magic link to your `ADMIN_EMAIL`,
click it. You should land on `/dashboard/agents`.

### 5. Set up one agent folder (≈ 4 min)

```bash
mkdir -p ~/agents
cp -R templates/agent-boilerplate ~/agents/mana
cd ~/agents/mana
```

Edit `CLAUDE.md`:

- replace `[AGENT_NAME]` with `MANA`
- replace `<USER_NAME>` with your first name
- fill in §1 (Identitaet) and §2 (Kommunikationsstil) in 2–3 sentences

`MEMORY.md` and `CURRENT.md` can stay empty for now.

### 6. Start the Bridge in file-drop mode (≈ 6 min)

```bash
cd <repo>/bridge
cp .env.example .env
```

In `bridge/.env` set:

- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (same project as the dashboard,
  but use the **secret** key, not the publishable one)
- `BRIDGE_MODE=file_drop`
- `BRIDGE_AGENT_NAMES=mana`
- `BRIDGE_AGENTS_DIR=$HOME/agents`

Then:

```bash
npm install
npm start
```

You should see `[connector] starting`, `[file-drop] watching`, and the
dashboard heartbeat indicator going live within ~10 seconds.

### 7. Start the agent in tmux + first message (≈ 8 min)

In a fresh terminal:

```bash
tmux new -s mana
cd ~/agents/mana
claude --dangerously-skip-permissions
```

In Claude Code, wait until the boot finishes and the agent has read
`CLAUDE.md`. Detach with `Ctrl+b` then `d`.

Open the dashboard, go to **Agents → mana → Chat**, send any message. Within
seconds the message appears in `~/agents/mana/inbox/` (Bridge wrote it),
the tmux Claude Code reads it, processes it, writes a reply to
`~/agents/mana/outbox/`, the Bridge picks it up, and the reply appears in
the dashboard chat.

## Done

If you got the round-trip in step 7, the speedrun is complete. From here:

- Make the Bridge survive reboots:
  `cd bridge && npm run launchd:install` (`docs/bridge-persistence.md`)
- Make the agent survive reboots: copy `templates/launchagents/agent.plist.example`
  per agent (`docs/agent-setup.md` § Persistence)
- Add a Knowledge Base: `templates/knowledge-base/` + `MANA_HUB_KNOWLEDGE_ROOT`
  in `.env.local` (`docs/agent-setup.md` § Knowledge Base)
- Add cron briefings: `templates/agent-boilerplate/snippets/briefing-routine.md`
  + `npm run cron:create` (`docs/cron-and-briefings.md`)
- Risk-Approval: `docs/risk-approval.md`

## What if something fails?

- `npm run doctor` failing → fix the listed env value, re-run.
- Login screen redirects loop → `NEXT_PUBLIC_APP_URL` must match the actual
  port `next dev` is on (check the boot log).
- Bridge prints `[connector] error` → wrong `SUPABASE_SECRET_KEY` or
  `SUPABASE_URL` (URL must NOT end with `/rest/v1`).
- Dashboard chat says "Agent offline" → tmux Claude Code is not running, or
  Bridge cannot find `~/agents/mana/` (check `BRIDGE_AGENTS_DIR`).
- Reply never arrives → `~/agents/mana/outbox/` is empty (Claude Code didn't
  write a reply) or has a malformed YAML header (check `reply_to_id`).

For deeper debugging, switch back to the install-helper skill or
`docs/fresh-install-checklist.md`.

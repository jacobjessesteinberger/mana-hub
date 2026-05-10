# Bridge Modes — Inline vs. File-Drop

The Mana Hub Bridge has two operating modes, controlled by `BRIDGE_MODE` in `bridge/.env`.

## Mode 1: `inline` (default)

Bridge runs the LLM call itself, inside `bridge/src/handler.ts`.

```
Dashboard --> agent_messages (user)
                    |
                    | realtime + polling
                    v
              Bridge handler.ts
                    |
                    | LLM API call (you wire this up)
                    v
              agent_messages (assistant)
                    |
                    v
              Dashboard
```

**Use when:**

- You want a single Node process per agent that does everything
- You have an Anthropic / OpenAI / local API key
- You don't need agents to have their own separate Claude Code sessions

**Trade-offs:**

- Pro: simple, one process to manage
- Con: no per-agent persistent memory beyond what you load into each call
- Con: no separate file system per agent for tools to read/write

This is the default for fresh installs and for the `BRIDGE_ECHO_PREFIX` echo-stub.

## Mode 2: `file_drop` (course mode from Module 3 onwards)

Bridge does not call any LLM. It mediates between Supabase and per-agent Claude Code sessions running in tmux.

```
Dashboard --> agent_messages (user)
                    |
                    | realtime + polling
                    v
              Bridge writes msg-*.md
                    |
                    v
~/agents/<name>/inbox/msg-2026-05-09T...-<id>.md
                    |
                    | (optional) tmux send-keys "process_inbox"
                    v
              Claude Code in tmux session "<name>"
                    |
                    | reads MEMORY.md, CURRENT.md, knowledge-base/, inbox file
                    | writes reply-*.md
                    v
~/agents/<name>/outbox/reply-2026-05-09T...-<id>.md
                    |
                    | chokidar watcher
                    v
              Bridge writes assistant row
                    |
                    v
              agent_messages
                    |
                    v
              Dashboard
```

**Use when:**

- You follow the course from Module 3 onwards
- You want each agent to have its own Claude Code session with its own MCP tools, memory, and knowledge base
- You want agents to be able to write files, run shell commands, and use MCP servers

**Trade-offs:**

- Pro: full agent autonomy, per-agent file system, MCP tools per agent
- Pro: agents survive bridge restarts (their tmux sessions are independent)
- Con: more moving parts (bridge + N tmux sessions + LaunchAgents per agent)
- Con: macOS-specific (tmux + LaunchAgents). Linux/Windows would need adaptation.

## Configuration

In `bridge/.env`:

```bash
# inline mode (default)
BRIDGE_MODE=inline

# file_drop mode (course)
BRIDGE_MODE=file_drop
BRIDGE_AGENTS_DIR=$HOME/agents      # base directory containing one folder per agent
BRIDGE_TMUX_ENABLED=true            # send tmux notifications when new inbox files arrive
BRIDGE_AGENT_NAMES=orchestrator,researcher  # comma-separated list of agents to handle
```

After changing the mode, restart the bridge:

```bash
cd bridge && npm run launchd:restart
```

## Cron jobs in both modes

The cron tick loop (`bridge/src/cron.ts`) works in both modes:

- **inline:** triggers a `system` row in `agent_messages` with `metadata.kind=cron_trigger`. Your `handler.ts` should pick it up and pass the prompt to the LLM.
- **file_drop:** writes `cron-<name>-<ISO>.md` to the agent's inbox. Claude Code processes it like a normal inbox message.

Cron interval is set by `BRIDGE_CRON_TICK_INTERVAL_MS` (default 300000 = 5 minutes).

## Switching back

You can switch modes any time. There's no migration step — just change `BRIDGE_MODE` and restart. Existing rows in `agent_messages` are unaffected.

## Smoke tests

```bash
# requires BRIDGE_MODE=file_drop
bash bridge/scripts/smoke-file-drop.sh

# requires a running cron tick — temporarily set BRIDGE_CRON_TICK_INTERVAL_MS=15000
bash bridge/scripts/smoke-cron.sh
```

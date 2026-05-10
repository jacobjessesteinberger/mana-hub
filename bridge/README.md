# Bridge

The Mana Hub Bridge is a long-running Node process that connects Supabase to your AI agent runtime. It subscribes to `agent_messages` via Supabase Realtime, dispatches new user messages to the configured agent, and writes assistant replies back.

## Two operating modes

| Mode | What it does | When to use |
|---|---|---|
| `inline` (default) | Bridge calls the LLM API directly inside `src/handler.ts`. One process handles everything. | Fresh installs, simple setups, demo mode. |
| `file_drop` | Bridge writes user messages as `msg-*.md` to `~/agents/<name>/inbox/`, watches `outbox/` for `reply-*.md`, syncs back. The actual agent (Claude Code in tmux) runs separately. | Course Module 3 onwards; full per-agent autonomy. |

Switch via `BRIDGE_MODE` in `bridge/.env`. Detail in `docs/bridge-modes.md`.

## Quick start

```bash
cd bridge
cp .env.example .env
# fill in SUPABASE_URL (without /rest/v1/) and SUPABASE_SECRET_KEY
npm install
npm start
```

This starts the bridge in `inline` mode with the echo-stub handler. Replace `src/handler.ts` with a real LLM call when you're ready, or switch to `file_drop` mode and let Claude Code do the work.

## Persistence

The bridge is a long-running process. For real use you want it to survive Cursor restarts and Mac sleeps.

```bash
npm run launchd:install
```

Installs a macOS LaunchAgent with `caffeinate -i`, auto-start at login, auto-restart on crash. Day-to-day:

```bash
npm run launchd:status      # is it running?
npm run launchd:logs        # tail logs
npm run launchd:restart     # after editing src/handler.ts
npm run launchd:uninstall   # remove
```

Other options (Cursor terminal, iTerm + caffeinate, Linux/Windows): see `docs/bridge-persistence.md`.

## Cron system

Overview and schema pointers: [`docs/cron-system.md`](../docs/cron-system.md).

Bridge polls `agent_cron_jobs` every `BRIDGE_CRON_TICK_INTERVAL_MS` (default 5 minutes). Jobs whose `schedule_hour`, `schedule_minute`, and (optional) `schedule_day` match the current time are triggered:

- `inline` mode: Bridge inserts a system row in `agent_messages` with `metadata.kind=cron_trigger`.
- `file_drop` mode: Bridge writes `cron-<name>-<ISO>.md` to the agent's inbox.

`agent_cron_jobs.last_run_at` and `last_status` are updated after each trigger. Cron jobs are managed via Supabase directly or via the dashboard's Cron UI.

User-proposed cron jobs land in `cron_requests` and require approval before being created in `agent_cron_jobs` (Course Lesson 4.4).

## Replacing the echo-stub with a real LLM (inline mode only)

`src/handler.ts` exports `handleUserMessage()`. The default implementation is an echo stub. To wire up a real LLM:

```ts
// bridge/src/handler.ts
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function handleUserMessage(msg, _echoPrefix, signal) {
  const completion = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: msg.content }],
  }, { signal })
  return {
    content: completion.content.map(c => c.type === 'text' ? c.text : '').join('\n'),
    metadata: { model: completion.model, usage: completion.usage },
  }
}
```

Don't forget to install `@anthropic-ai/sdk` and add `ANTHROPIC_API_KEY` to `bridge/.env`.

For more control (system prompts, tool use, streaming, attachment handling), build it out from there. Or skip this entirely and use `file_drop` mode where Claude Code handles all of it.

## File layout

```
bridge/
  src/
    index.ts          # entry: load config, start everything, handle SIGINT/SIGTERM
    env.ts            # parse + validate bridge/.env via zod
    supabase.ts       # service-role client
    types.ts          # shared types (AgentMessage, BridgeConfig, BridgeMode, ...)
    connector.ts      # subscribe to agent_messages, dispatch by mode
    handler.ts        # inline-mode LLM call (currently echo-stub)
    file-drop.ts      # write inbox/, watch outbox/ via chokidar, tmux send-keys
    cron.ts           # poll agent_cron_jobs every N minutes, trigger
    activity.ts       # update agent_activity rows
    heartbeat.ts      # write agent_heartbeats periodically
    lifecycle.ts      # decide active/edited/superseded/retracted
    stop.ts           # AbortController per agent for /stop requests
  scripts/
    start-with-caffeinate.sh
    smoke-file-drop.sh
    smoke-cron.sh
  launchd/
    com.manahub.bridge.plist.example
    install.sh / uninstall.sh / status.sh / logs.sh
    README.md
  .env.example
  package.json
```

## Agent contract

What the bridge expects from a `file_drop` agent in `~/agents/<name>/`:

- `inbox/` — bridge writes `msg-*.md` and `cron-*.md` here, files have YAML front matter (id, role, created_at, kind, attachments)
- `outbox/` — agent writes `reply-*.md` here, file has YAML front matter (`reply_to_id`, `created_at`) plus markdown body
- Bridge moves processed inbox files to `inbox/processed/`, processed outbox files to `outbox/processed/`
- Agent should poll inbox/ regularly OR react to a `process_inbox` keystroke from `tmux send-keys` (see `BRIDGE_TMUX_ENABLED`)

What the agent boilerplate provides for this contract: see `templates/agent-boilerplate/CLAUDE.md` section 6.

## Smoke tests

```bash
bash scripts/smoke-file-drop.sh   # inserts message, waits for inbox, writes reply, waits for assistant row
bash scripts/smoke-cron.sh        # inserts cron job, waits for trigger
```

## Connector contract (for custom connectors)

If you build your own connector instead of using this bridge:

- Subscribe or poll `agent_messages` filtered by your agent name(s)
- Process only `role='user'` messages with active lifecycle status (skip `edited`, `superseded`, `retracted`)
- Pass attachment metadata to the agent runtime
- Write assistant replies as `role='assistant'` with `reply_to_id` set
- Update `agent_activity` (status, current_task) and write `agent_heartbeats` periodically
- Handle stop requests: system rows with `metadata.kind='agent_control'` and `metadata.command='stop'`

Private connector code can live under `bridge/` during local work, but production secrets and user-specific paths must stay out of Git.

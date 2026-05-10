# Bridge Persistence (macOS)

The bridge is a long-running process. If you start it inside a Cursor terminal it dies when you close Cursor. For day-to-day use, run it as a real background service.

## Three options, in increasing seriousness

### 1. Cursor terminal (development only)

Just run `npm start` inside `bridge/`. Dies when Cursor closes. Fine while building.

### 2. iTerm + caffeinate (single-session, manual)

```bash
cd bridge
npm run start:keep-awake
```

This wraps the bridge in `caffeinate -i` so the Mac will not enter system idle sleep while the iTerm window is open. You still need to keep iTerm open and the Mac unlocked.

### 3. LaunchAgent (recommended, fully persistent)

One-time install:

```bash
cd bridge
npm run launchd:install
```

This:

- resolves a stable Node binary outside Cursor (pnpm-managed Node, nvm, or brew — never Cursor's bundled Node, which disappears when Cursor closes)
- writes `~/Library/LaunchAgents/com.manahub.bridge.plist` from the template at `bridge/launchd/com.manahub.bridge.plist.example`
- loads it with `launchctl bootstrap gui/$UID`
- starts the bridge under `caffeinate -i` so the Mac stays awake while it runs

Behaviour:

- **`RunAtLoad: true`** — starts at user login
- **`KeepAlive: true`** — auto-restart on crash
- **`ThrottleInterval: 10`** — minimum 10 seconds between restart attempts (prevents crash loops)
- **`caffeinate -i`** — prevents system idle sleep, but allows display sleep
- Logs go to `~/Library/Logs/mana-hub-bridge/bridge.log` and `bridge.error.log`

Day-to-day:

```bash
npm run launchd:status      # is it running? shows PID and last log lines
npm run launchd:logs        # tail bridge.log + bridge.error.log
npm run launchd:restart     # force restart, e.g. after editing src/handler.ts
npm run launchd:uninstall   # stop and remove
```

## What to remember

- `~/Library/LaunchAgents/com.manahub.bridge.plist` is **User Space** — your machine, your absolute paths. Only the committed `*.plist.example` template lives in the repo.
- Same for `~/Library/Logs/mana-hub-bridge/` — User Space, not in the repo.
- After editing `bridge/src/` (e.g. swapping the echo handler for a real LLM call), run `npm run launchd:restart`. The bridge does not hot-reload.
- **One bridge per Supabase project per agent name.** If you accidentally have two running (one in a Cursor terminal + one under launchd), they will both reply to every message.
- To check for orphan bridges started from a Cursor terminal: `pkill -f 'tsx src/index.ts'` (or list with `pgrep -af 'tsx src/index.ts'` first).

## Per-Agent LaunchAgents

The bridge LaunchAgent above is the bridge process itself. Each Mana-Hub-Agent (Claude Code in tmux) gets its own LaunchAgent via `templates/launchagents/`:

```bash
bash templates/launchagents/install-agent.sh <agent-name>
```

See `templates/launchagents/README.md` for details.

## Linux / Windows

Not yet covered by the Core. Equivalent setups:

- Linux: `systemd --user` unit. Template not included yet, contributions welcome.
- Windows: NSSM or a scheduled task. Template not included yet.

For now both should work fine if you start the bridge with `npm start` inside any persistent terminal multiplexer (`tmux`, `screen`, Windows Terminal with auto-restart).

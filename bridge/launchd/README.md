# Bridge LaunchAgent

Run the Mana Hub Bridge as a macOS background service that auto-starts at login and restarts on crash. Wraps the bridge in `caffeinate -i` so the Mac will not enter system idle sleep while the bridge is listening.

## Files

- `com.manahub.bridge.plist.example` — template with `__NODE_PATH__`, `__TSX_CLI__`, `__BRIDGE_DIR__`, `__HOME__` placeholders. Tracked in git, no machine-specific paths.
- `install.sh` — resolves a stable node binary outside Cursor, substitutes placeholders, writes `~/Library/LaunchAgents/com.manahub.bridge.plist`, and loads it with `launchctl bootstrap`.
- `uninstall.sh` — `launchctl bootout` and removes the plist.
- `status.sh` — shows LaunchAgent state, current PID, and the last log lines.
- `logs.sh` — `tail -F` on `bridge.log` and `bridge.error.log`.

## Usage

From `bridge/`:

```bash
npm run launchd:install     # install + load (one time)
npm run launchd:status      # is it running?
npm run launchd:logs        # tail the logs
npm run launchd:restart     # force restart (e.g. after handler.ts change)
npm run launchd:uninstall   # stop and remove
```

## Where things live after install

- LaunchAgent plist: `~/Library/LaunchAgents/com.manahub.bridge.plist` (gitignored if accidentally placed here, also outside the repo)
- Logs: `~/Library/Logs/mana-hub-bridge/bridge.log` and `bridge.error.log`

## Behaviour

- `RunAtLoad: true` — starts at user login
- `KeepAlive: true` — auto-restart if the bridge crashes
- `ThrottleInterval: 10` — at least 10 seconds between restart attempts (avoids crash loops)
- `caffeinate -i` — prevents system idle sleep, but allows display sleep

## Updating the bridge code

After editing files in `bridge/src/` (e.g. swapping the echo handler for a real LLM call):

```bash
npm run launchd:restart
```

This `kickstart -k` reloads the bridge process without uninstalling the LaunchAgent.

## Why this is User Space, not Core

`AGENTS.md` says the Mana Hub Core must not hard-code `/Users/...` paths. The substituted plist contains your absolute home and bridge paths, so it lives in `~/Library/LaunchAgents/` and is gitignored if it ever ends up here. Only the template (`*.example`) and helper scripts (no hardcoded paths) are committed.

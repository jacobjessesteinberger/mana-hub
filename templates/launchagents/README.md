# Agent LaunchAgents

Generic macOS LaunchAgent template + helper scripts for running Mana Hub Agents (Claude Code in tmux) as background services that start at login and auto-restart on crash.

This is the per-Agent equivalent of `bridge/launchd/`, which handles the bridge process itself.

## Files

| File | Purpose |
|---|---|
| `agent.plist.example` | Template with `__AGENT_NAME__`, `__AGENT_DIR__`, `__HOME__`, `__TMUX_PATH__`, `__CLAUDE_PATH__` placeholders. Tracked in git, no machine-specific paths. |
| `start-agent.sh.example` | Minimal one-shot: `caffeinate` + `tmux new-session` + `claude --dangerously-skip-permissions` (placeholders `__AGENT_NAME__`, `__AGENT_DIR__`). For teaching; production path is `install-agent.sh`. |
| `install-agent.sh` | Resolves binaries (tmux, claude), substitutes placeholders, writes `~/Library/LaunchAgents/ai.claude.<name>.plist`, loads with `launchctl bootstrap`. |
| `uninstall-agent.sh` | `launchctl bootout`, removes plist, kills tmux session. |
| `status-agent.sh` | Shows LaunchAgent state, tmux session status, last log lines. |
| `logs-agent.sh` | `tail -F` on the agent's log files. |

## Usage

After copying `templates/agent-boilerplate/` to `~/agents/<your-agent>/` and writing `CLAUDE.md`, install the LaunchAgent:

```bash
bash templates/launchagents/install-agent.sh <your-agent-name>
```

This is the script the Cursor-Prompt #18 in Lesson 3.5 of the course will run.

Day-to-day:

```bash
bash templates/launchagents/status-agent.sh <name>     # is it running?
bash templates/launchagents/logs-agent.sh <name>       # tail logs
bash templates/launchagents/uninstall-agent.sh <name>  # stop and remove
```

To force-restart after editing `CLAUDE.md` or other agent files:

```bash
launchctl kickstart -k gui/$UID/ai.claude.<name>
```

## Where things live after install

- LaunchAgent plist: `~/Library/LaunchAgents/ai.claude.<name>.plist` (User Space, gitignored if accidentally placed here)
- Logs: `~/Library/Logs/mana-hub-agents/<name>.log` and `<name>.error.log`
- tmux session: named after the agent, attach with `tmux attach -t <name>`

## Behaviour

- `RunAtLoad: true` — starts at user login
- `KeepAlive: true` — auto-restart if the agent crashes
- `ThrottleInterval: 15` — at least 15 seconds between restart attempts
- Inside tmux: `caffeinate -i claude --dangerously-skip-permissions` — Claude Code runs unattended (no permission dialogs), system stays awake
- tmux session persists separately from caffeinate/claude — if claude crashes inside tmux, the LaunchAgent's KeepAlive will restart the whole tmux session

## Why a separate `ai.claude.*` namespace

The bridge LaunchAgent uses `com.manahub.bridge`. Agent LaunchAgents use `ai.claude.<name>` to make it visually obvious which one is which, and to make `launchctl print gui/$UID/ai.claude.*` enumerable.

## Why this is User Space, not Core

`AGENTS.md` says the Mana Hub Core must not hard-code `/Users/...` paths. The substituted plist contains your absolute home and agent paths, so it lives in `~/Library/LaunchAgents/` and is gitignored if it ever ends up here. Only the template (`*.example`) and helper scripts (no hardcoded paths) are committed.

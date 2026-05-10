#!/usr/bin/env bash
# Stop and remove a Mana Hub Agent LaunchAgent.
# Usage: bash uninstall-agent.sh <agent-name>

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "[uninstall-agent] Usage: bash uninstall-agent.sh <agent-name>"
  exit 1
fi

AGENT_NAME="$1"
TARGET="$HOME/Library/LaunchAgents/ai.claude.$AGENT_NAME.plist"
LABEL="ai.claude.$AGENT_NAME"
DOMAIN="gui/$(id -u)"

if launchctl print "$DOMAIN/$LABEL" > /dev/null 2>&1; then
  echo "[uninstall-agent] booting out LaunchAgent..."
  launchctl bootout "$DOMAIN" "$TARGET" 2>/dev/null || true
else
  echo "[uninstall-agent] LaunchAgent not loaded."
fi

if [ -f "$TARGET" ]; then
  rm -f "$TARGET"
  echo "[uninstall-agent] removed $TARGET"
else
  echo "[uninstall-agent] no plist at $TARGET"
fi

if command -v tmux >/dev/null 2>&1 && tmux has-session -t "$AGENT_NAME" 2>/dev/null; then
  echo "[uninstall-agent] killing tmux session '$AGENT_NAME'..."
  tmux kill-session -t "$AGENT_NAME"
fi

echo "[uninstall-agent] done. Logs in ~/Library/Logs/mana-hub-agents/ are kept."

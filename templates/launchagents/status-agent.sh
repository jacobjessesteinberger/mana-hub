#!/usr/bin/env bash
# Show LaunchAgent state, tmux session status, and last log lines.
# Usage: bash status-agent.sh <agent-name>

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "[status-agent] Usage: bash status-agent.sh <agent-name>"
  exit 1
fi

AGENT_NAME="$1"
LABEL="ai.claude.$AGENT_NAME"
DOMAIN="gui/$(id -u)"
LOG="$HOME/Library/Logs/mana-hub-agents/$AGENT_NAME.log"
ERR="$HOME/Library/Logs/mana-hub-agents/$AGENT_NAME.error.log"

echo "=== launchctl summary ==="
if ! launchctl print "$DOMAIN/$LABEL" > /dev/null 2>&1; then
  echo "[status-agent] LaunchAgent NOT loaded for '$AGENT_NAME'."
  echo "[status-agent] Install with: bash templates/launchagents/install-agent.sh $AGENT_NAME"
  exit 1
fi
launchctl print "$DOMAIN/$LABEL" | grep -E '^\s*(state|pid|program|exit code|last exit code|spawn type)\s*=' || true

echo ""
echo "=== tmux session '$AGENT_NAME' ==="
if command -v tmux >/dev/null 2>&1 && tmux has-session -t "$AGENT_NAME" 2>/dev/null; then
  echo "Active. Attach: tmux attach -t $AGENT_NAME"
  tmux list-windows -t "$AGENT_NAME" 2>/dev/null | head -5
else
  echo "tmux session NOT running. LaunchAgent may still be starting it."
fi

echo ""
echo "=== last 10 lines of $AGENT_NAME.log ==="
if [ -f "$LOG" ]; then
  tail -n 10 "$LOG"
else
  echo "(no log yet)"
fi

if [ -s "$ERR" ]; then
  echo ""
  echo "=== last 10 lines of $AGENT_NAME.error.log ==="
  tail -n 10 "$ERR"
fi

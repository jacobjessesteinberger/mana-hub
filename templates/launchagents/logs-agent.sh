#!/usr/bin/env bash
# Tail the agent's log files. Press Ctrl+C to stop.
# Usage: bash logs-agent.sh <agent-name>

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "[logs-agent] Usage: bash logs-agent.sh <agent-name>"
  exit 1
fi

AGENT_NAME="$1"
LOG="$HOME/Library/Logs/mana-hub-agents/$AGENT_NAME.log"
ERR="$HOME/Library/Logs/mana-hub-agents/$AGENT_NAME.error.log"

mkdir -p "$(dirname "$LOG")"
touch "$LOG" "$ERR"

echo "[logs-agent] tailing $LOG and $ERR (Ctrl+C to stop)"
exec tail -F "$LOG" "$ERR"

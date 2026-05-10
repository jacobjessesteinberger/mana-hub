#!/usr/bin/env bash
# Tail the Mana Hub Bridge log and error log. Press Ctrl+C to stop.

set -euo pipefail

LOG="$HOME/Library/Logs/mana-hub-bridge/bridge.log"
ERR="$HOME/Library/Logs/mana-hub-bridge/bridge.error.log"

mkdir -p "$(dirname "$LOG")"
touch "$LOG" "$ERR"

echo "[logs] tailing $LOG and $ERR (Ctrl+C to stop)"
exec tail -F "$LOG" "$ERR"

#!/usr/bin/env bash
# Show LaunchAgent state, current PID, and the last few log lines.

set -euo pipefail

LABEL="com.manahub.bridge"
DOMAIN="gui/$(id -u)"
LOG="$HOME/Library/Logs/mana-hub-bridge/bridge.log"
ERR="$HOME/Library/Logs/mana-hub-bridge/bridge.error.log"

if ! launchctl print "$DOMAIN/$LABEL" > /dev/null 2>&1; then
  echo "[status] LaunchAgent NOT loaded. Run 'bash launchd/install.sh' first."
  exit 1
fi

echo "=== launchctl summary ==="
launchctl print "$DOMAIN/$LABEL" | grep -E '^\s*(state|pid|program|exit code|last exit code|spawn type|on demand)\s*=' || true

echo ""
echo "=== last 15 lines of bridge.log ==="
if [ -f "$LOG" ]; then
  tail -n 15 "$LOG"
else
  echo "(no log yet)"
fi

if [ -s "$ERR" ]; then
  echo ""
  echo "=== last 10 lines of bridge.error.log ==="
  tail -n 10 "$ERR"
fi

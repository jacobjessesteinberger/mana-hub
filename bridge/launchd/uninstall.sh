#!/usr/bin/env bash
# Stop and remove the Mana Hub Bridge LaunchAgent.

set -euo pipefail

TARGET="$HOME/Library/LaunchAgents/com.manahub.bridge.plist"
LABEL="com.manahub.bridge"
DOMAIN="gui/$(id -u)"

if launchctl print "$DOMAIN/$LABEL" > /dev/null 2>&1; then
  echo "[uninstall] booting out LaunchAgent..."
  launchctl bootout "$DOMAIN" "$TARGET" 2>/dev/null || true
else
  echo "[uninstall] LaunchAgent not loaded."
fi

if [ -f "$TARGET" ]; then
  rm -f "$TARGET"
  echo "[uninstall] removed $TARGET"
else
  echo "[uninstall] no plist at $TARGET"
fi

echo "[uninstall] done. Logs in ~/Library/Logs/mana-hub-bridge/ are kept."

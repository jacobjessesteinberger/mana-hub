#!/usr/bin/env bash
# Install the Mana Hub Bridge as a macOS LaunchAgent.
# - Resolves a stable node binary outside Cursor.
# - Substitutes placeholders in the plist template.
# - Loads the LaunchAgent so it starts at login and auto-restarts on crash.

set -euo pipefail

LAUNCHD_DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_DIR="$(cd "$LAUNCHD_DIR/.." && pwd)"
TEMPLATE="$LAUNCHD_DIR/com.manahub.bridge.plist.example"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET="$TARGET_DIR/com.manahub.bridge.plist"
LOG_DIR="$HOME/Library/Logs/mana-hub-bridge"
LABEL="com.manahub.bridge"
DOMAIN="gui/$(id -u)"

if [ ! -f "$TEMPLATE" ]; then
  echo "[install] Template missing: $TEMPLATE"
  exit 1
fi

if [ ! -f "$BRIDGE_DIR/.env" ]; then
  echo "[install] bridge/.env is missing. Copy bridge/.env.example to bridge/.env and fill in real values first."
  exit 1
fi

TSX_CLI="$BRIDGE_DIR/node_modules/tsx/dist/cli.mjs"
if [ ! -f "$TSX_CLI" ]; then
  echo "[install] $TSX_CLI is missing. Run 'npm install' inside bridge/ first."
  exit 1
fi

resolve_node() {
  local candidates=(
    "$HOME/Library/pnpm/node"
    "$HOME/.nvm/versions/node/$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)/bin/node"
    "/opt/homebrew/bin/node"
    "/usr/local/bin/node"
    "/usr/bin/node"
  )
  for path in "${candidates[@]}"; do
    if [ -x "$path" ] || [ -L "$path" ]; then
      readlink -f "$path" 2>/dev/null || echo "$path"
      return 0
    fi
  done
  return 1
}

NODE_PATH="$(resolve_node || true)"
if [ -z "$NODE_PATH" ]; then
  echo "[install] Could not find a stable node binary outside Cursor."
  echo "[install] Install Node from https://nodejs.org or via 'brew install node' or 'pnpm env use --global lts', then re-run."
  exit 1
fi

echo "[install] node:        $NODE_PATH"
echo "[install] tsx cli:     $TSX_CLI"
echo "[install] bridge dir:  $BRIDGE_DIR"
echo "[install] log dir:     $LOG_DIR"
echo "[install] target plist: $TARGET"

mkdir -p "$TARGET_DIR" "$LOG_DIR"

if launchctl print "$DOMAIN/$LABEL" > /dev/null 2>&1; then
  echo "[install] LaunchAgent already loaded, bootout first..."
  launchctl bootout "$DOMAIN" "$TARGET" 2>/dev/null || true
fi

NODE_ESC="${NODE_PATH//\//\\/}"
TSX_ESC="${TSX_CLI//\//\\/}"
BRIDGE_ESC="${BRIDGE_DIR//\//\\/}"
HOME_ESC="${HOME//\//\\/}"

sed \
  -e "s/__NODE_PATH__/$NODE_ESC/g" \
  -e "s/__TSX_CLI__/$TSX_ESC/g" \
  -e "s/__BRIDGE_DIR__/$BRIDGE_ESC/g" \
  -e "s/__HOME__/$HOME_ESC/g" \
  "$TEMPLATE" > "$TARGET"

echo "[install] plist written, verifying syntax..."
plutil -lint "$TARGET"

echo "[install] loading LaunchAgent..."
launchctl bootstrap "$DOMAIN" "$TARGET"

sleep 2

echo "[install] LaunchAgent state:"
launchctl print "$DOMAIN/$LABEL" | grep -E '^\s*(state|pid|program)\s*=' || true

echo ""
echo "[install] Done. Tail logs with: bash $LAUNCHD_DIR/logs.sh"
echo "[install] Status:               bash $LAUNCHD_DIR/status.sh"
echo "[install] Uninstall:            bash $LAUNCHD_DIR/uninstall.sh"

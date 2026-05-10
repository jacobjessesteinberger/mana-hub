#!/usr/bin/env bash
# Install a Mana Hub Agent as a macOS LaunchAgent.
# Usage: bash install-agent.sh <agent-name> [agent-dir]
#   <agent-name>: lowercase short name, e.g. "taro"
#   [agent-dir]:  absolute path to agent directory (default: $HOME/agents/<agent-name>)

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "[install-agent] Usage: bash install-agent.sh <agent-name> [agent-dir]"
  exit 1
fi

AGENT_NAME="$1"
AGENT_DIR="${2:-$HOME/agents/$AGENT_NAME}"
LAUNCHD_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="$LAUNCHD_DIR/agent.plist.example"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET="$TARGET_DIR/ai.claude.$AGENT_NAME.plist"
LOG_DIR="$HOME/Library/Logs/mana-hub-agents"
LABEL="ai.claude.$AGENT_NAME"
DOMAIN="gui/$(id -u)"

if [ ! -f "$TEMPLATE" ]; then
  echo "[install-agent] Template missing: $TEMPLATE"
  exit 1
fi

if [ ! -d "$AGENT_DIR" ]; then
  echo "[install-agent] Agent directory does not exist: $AGENT_DIR"
  echo "[install-agent] Run: cp -R templates/agent-boilerplate $AGENT_DIR"
  exit 1
fi

if [ ! -f "$AGENT_DIR/CLAUDE.md" ]; then
  echo "[install-agent] $AGENT_DIR/CLAUDE.md missing. Agent boilerplate not properly initialized."
  exit 1
fi

resolve_bin() {
  local name="$1"
  shift
  for path in "$@"; do
    if [ -x "$path" ] || [ -L "$path" ]; then
      echo "$path"
      return 0
    fi
  done
  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return 0
  fi
  return 1
}

TMUX_PATH="$(resolve_bin tmux /opt/homebrew/bin/tmux /usr/local/bin/tmux /usr/bin/tmux || true)"
if [ -z "$TMUX_PATH" ]; then
  echo "[install-agent] tmux not found. Install with: brew install tmux"
  exit 1
fi

CLAUDE_PATH="$(resolve_bin claude "$HOME/.claude/local/claude" /opt/homebrew/bin/claude /usr/local/bin/claude || true)"
if [ -z "$CLAUDE_PATH" ]; then
  echo "[install-agent] claude binary not found. Install Claude Code: https://docs.anthropic.com/claude-code"
  exit 1
fi

echo "[install-agent] agent name:    $AGENT_NAME"
echo "[install-agent] agent dir:     $AGENT_DIR"
echo "[install-agent] tmux path:     $TMUX_PATH"
echo "[install-agent] claude path:   $CLAUDE_PATH"
echo "[install-agent] log dir:       $LOG_DIR"
echo "[install-agent] target plist:  $TARGET"

mkdir -p "$TARGET_DIR" "$LOG_DIR"

if launchctl print "$DOMAIN/$LABEL" > /dev/null 2>&1; then
  echo "[install-agent] LaunchAgent already loaded, bootout first..."
  launchctl bootout "$DOMAIN" "$TARGET" 2>/dev/null || true
fi

AGENT_DIR_ESC="${AGENT_DIR//\//\\/}"
HOME_ESC="${HOME//\//\\/}"
TMUX_ESC="${TMUX_PATH//\//\\/}"
CLAUDE_ESC="${CLAUDE_PATH//\//\\/}"

sed \
  -e "s/__AGENT_NAME__/$AGENT_NAME/g" \
  -e "s/__AGENT_DIR__/$AGENT_DIR_ESC/g" \
  -e "s/__HOME__/$HOME_ESC/g" \
  -e "s/__TMUX_PATH__/$TMUX_ESC/g" \
  -e "s/__CLAUDE_PATH__/$CLAUDE_ESC/g" \
  "$TEMPLATE" > "$TARGET"

echo "[install-agent] plist written, verifying syntax..."
plutil -lint "$TARGET"

echo "[install-agent] loading LaunchAgent..."
launchctl bootstrap "$DOMAIN" "$TARGET"

sleep 2

echo "[install-agent] LaunchAgent state:"
launchctl print "$DOMAIN/$LABEL" | grep -E '^\s*(state|pid|program)\s*=' || true

echo ""
echo "[install-agent] Done. Agent '$AGENT_NAME' is running in tmux session '$AGENT_NAME'."
echo "[install-agent] View tmux session: tmux attach -t $AGENT_NAME (Ctrl+B then D to detach)"
echo "[install-agent] Tail logs:         bash $LAUNCHD_DIR/logs-agent.sh $AGENT_NAME"
echo "[install-agent] Status:            bash $LAUNCHD_DIR/status-agent.sh $AGENT_NAME"
echo "[install-agent] Uninstall:         bash $LAUNCHD_DIR/uninstall-agent.sh $AGENT_NAME"

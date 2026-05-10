#!/usr/bin/env bash
# Smoke test for BRIDGE_MODE=file_drop.
#
# What it does:
#   1. Inserts a fake user message into agent_messages for the first agent
#   2. Waits up to 10s for an inbox file to appear in BRIDGE_AGENTS_DIR/<agent>/inbox/
#   3. Writes a manual reply-*.md into outbox/
#   4. Waits up to 10s for an assistant row in agent_messages
#   5. Cleans up
#
# Prereqs:
#   - bridge/.env with BRIDGE_MODE=file_drop and valid Supabase creds
#   - Bridge process running (npm start or LaunchAgent)
#   - Agent directory exists at $BRIDGE_AGENTS_DIR/<agent>/ with inbox/ and outbox/

set -euo pipefail

BRIDGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$BRIDGE_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "[smoke] bridge/.env missing"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [ "${BRIDGE_MODE:-inline}" != "file_drop" ]; then
  echo "[smoke] BRIDGE_MODE is '${BRIDGE_MODE:-inline}', expected 'file_drop'."
  echo "[smoke] Set BRIDGE_MODE=file_drop in bridge/.env and restart the bridge."
  exit 1
fi

AGENT_NAMES_RAW="${BRIDGE_AGENT_NAMES:-orchestrator}"
AGENT="$(echo "$AGENT_NAMES_RAW" | cut -d',' -f1 | xargs)"
AGENTS_DIR="${BRIDGE_AGENTS_DIR/#\$HOME/$HOME}"
AGENTS_DIR="${AGENTS_DIR/#\~/$HOME}"
AGENT_DIR="$AGENTS_DIR/$AGENT"
INBOX_DIR="$AGENT_DIR/inbox"
OUTBOX_DIR="$AGENT_DIR/outbox"

echo "[smoke] agent:      $AGENT"
echo "[smoke] inbox:      $INBOX_DIR"
echo "[smoke] outbox:     $OUTBOX_DIR"

mkdir -p "$INBOX_DIR" "$OUTBOX_DIR"

UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TEST_BODY="smoke test $(date +%s)"

echo ""
echo "[smoke] step 1: insert fake user message via Supabase REST"
curl -sS -X POST "$SUPABASE_URL/rest/v1/agent_messages" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"id\":\"$UUID\",\"agent_name\":\"$AGENT\",\"role\":\"user\",\"content\":\"$TEST_BODY\",\"created_at\":\"$NOW\"}" \
  >/dev/null

echo "[smoke] step 2: wait for inbox file (up to 10s)..."
INBOX_FILE=""
for i in $(seq 1 20); do
  INBOX_FILE=$(ls -t "$INBOX_DIR"/msg-*${UUID:0:8}*.md 2>/dev/null | head -n1 || true)
  if [ -n "$INBOX_FILE" ]; then
    break
  fi
  sleep 0.5
done

if [ -z "$INBOX_FILE" ]; then
  echo "[smoke] FAIL: no inbox file appeared after 10s. Bridge running?"
  exit 1
fi
echo "[smoke] PASS: inbox file present: $INBOX_FILE"

echo ""
echo "[smoke] step 3: write manual reply to outbox"
REPLY_FILE="$OUTBOX_DIR/reply-${NOW//[:.]/-}-${UUID:0:8}.md"
cat > "$REPLY_FILE" <<EOF
---
reply_to_id: $UUID
created_at: $NOW
---

smoke reply for "$TEST_BODY"
EOF
echo "[smoke] wrote: $REPLY_FILE"

echo "[smoke] step 4: wait for assistant row in agent_messages (up to 10s)..."
FOUND=""
for i in $(seq 1 20); do
  RESP=$(curl -sS "$SUPABASE_URL/rest/v1/agent_messages?reply_to_id=eq.$UUID&role=eq.assistant&select=id,content" \
    -H "apikey: $SUPABASE_SECRET_KEY" \
    -H "Authorization: Bearer $SUPABASE_SECRET_KEY")
  if echo "$RESP" | grep -q '"role"'; then
    FOUND="yes"
    break
  fi
  if echo "$RESP" | grep -q '"content"'; then
    FOUND="yes"
    break
  fi
  sleep 0.5
done

if [ -z "$FOUND" ]; then
  echo "[smoke] FAIL: no assistant row found for reply_to_id=$UUID"
  exit 1
fi
echo "[smoke] PASS: assistant row inserted into agent_messages"

echo ""
echo "[smoke] step 5: cleanup test rows"
curl -sS -X DELETE "$SUPABASE_URL/rest/v1/agent_messages?reply_to_id=eq.$UUID" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  >/dev/null
curl -sS -X DELETE "$SUPABASE_URL/rest/v1/agent_messages?id=eq.$UUID" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  >/dev/null

# also clean processed inbox file
PROCESSED_INBOX=$(ls -t "$INBOX_DIR/processed/"msg-*${UUID:0:8}*.md 2>/dev/null | head -n1 || true)
[ -n "$PROCESSED_INBOX" ] && rm -f "$PROCESSED_INBOX" || true
PROCESSED_OUTBOX=$(ls -t "$OUTBOX_DIR/processed/"reply-*${UUID:0:8}*.md 2>/dev/null | head -n1 || true)
[ -n "$PROCESSED_OUTBOX" ] && rm -f "$PROCESSED_OUTBOX" || true
[ -f "$INBOX_FILE" ] && rm -f "$INBOX_FILE" || true

echo ""
echo "[smoke] all steps passed for agent '$AGENT' in file_drop mode."

#!/usr/bin/env bash
# Smoke test for the cron tick loop.
#
# What it does:
#   1. Inserts an enabled agent_cron_jobs row for the first agent
#      with schedule_hour/minute set to the next minute boundary.
#   2. Waits up to 90s for the bridge cron tick to fire.
#   3. Verifies that:
#      - file_drop mode: cron-*.md appears in <agentDir>/inbox/
#      - inline mode: a system row with metadata.kind=cron_trigger appears in agent_messages
#   4. Cleans up the test row.
#
# NOTE: BRIDGE_CRON_TICK_INTERVAL_MS in your bridge/.env determines how soon the
# tick runs. Default 300000 (5 min) is too slow for this smoke test. Temporarily
# set BRIDGE_CRON_TICK_INTERVAL_MS=15000 (15s) and restart the bridge before
# running this script.

set -euo pipefail

BRIDGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$BRIDGE_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "[smoke-cron] bridge/.env missing"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

AGENT_NAMES_RAW="${BRIDGE_AGENT_NAMES:-orchestrator}"
AGENT="$(echo "$AGENT_NAMES_RAW" | cut -d',' -f1 | xargs)"
MODE="${BRIDGE_MODE:-inline}"
AGENTS_DIR="${BRIDGE_AGENTS_DIR/#\$HOME/$HOME}"
AGENTS_DIR="${AGENTS_DIR/#\~/$HOME}"
INBOX_DIR="$AGENTS_DIR/$AGENT/inbox"

echo "[smoke-cron] agent:        $AGENT"
echo "[smoke-cron] mode:         $MODE"
echo "[smoke-cron] tick interval: ${BRIDGE_CRON_TICK_INTERVAL_MS:-300000}ms"

NEXT_MIN=$(date -u -v +1M +"%M" 2>/dev/null || date -u --date='1 minute' +"%M")
NEXT_HOUR=$(date -u -v +1M +"%H" 2>/dev/null || date -u --date='1 minute' +"%H")
LOCAL_MIN=$(date -v +1M +"%M" 2>/dev/null || date --date='1 minute' +"%M")
LOCAL_HOUR=$(date -v +1M +"%H" 2>/dev/null || date --date='1 minute' +"%H")
JOB_ID="smoke-cron-$(date +%s)"
JOB_NAME="smoke_test"
PROMPT="Smoke test cron prompt"

echo "[smoke-cron] inserting cron job (triggers at local ${LOCAL_HOUR}:${LOCAL_MIN})..."
curl -sS -X POST "$SUPABASE_URL/rest/v1/agent_cron_jobs" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"id\":\"$JOB_ID\",\"agent_id\":\"$AGENT\",\"name\":\"$JOB_NAME\",\"prompt\":\"$PROMPT\",\"enabled\":true,\"schedule_hour\":$LOCAL_HOUR,\"schedule_minute\":$LOCAL_MIN}" \
  >/dev/null

cleanup() {
  echo ""
  echo "[smoke-cron] cleanup: deleting cron job $JOB_ID"
  curl -sS -X DELETE "$SUPABASE_URL/rest/v1/agent_cron_jobs?id=eq.$JOB_ID" \
    -H "apikey: $SUPABASE_SECRET_KEY" \
    -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
    >/dev/null
  curl -sS -X DELETE "$SUPABASE_URL/rest/v1/agent_messages?metadata->>job_id=eq.$JOB_ID" \
    -H "apikey: $SUPABASE_SECRET_KEY" \
    -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
    >/dev/null
}
trap cleanup EXIT

echo "[smoke-cron] waiting up to 90s for trigger..."
TRIGGERED=""
for i in $(seq 1 45); do
  if [ "$MODE" = "file_drop" ]; then
    HIT=$(ls -t "$INBOX_DIR"/cron-*.md 2>/dev/null | head -n1 || true)
    if [ -n "$HIT" ] && grep -q "job_id: $JOB_ID" "$HIT" 2>/dev/null; then
      TRIGGERED="$HIT"
      break
    fi
  else
    RESP=$(curl -sS "$SUPABASE_URL/rest/v1/agent_messages?metadata->>job_id=eq.$JOB_ID&select=id" \
      -H "apikey: $SUPABASE_SECRET_KEY" \
      -H "Authorization: Bearer $SUPABASE_SECRET_KEY")
    if echo "$RESP" | grep -q '"id"'; then
      TRIGGERED="$RESP"
      break
    fi
  fi
  sleep 2
done

if [ -z "$TRIGGERED" ]; then
  echo "[smoke-cron] FAIL: cron did not trigger within 90s. Check bridge logs and BRIDGE_CRON_TICK_INTERVAL_MS."
  exit 1
fi

echo "[smoke-cron] PASS: cron triggered."
echo "[smoke-cron] result: $TRIGGERED"

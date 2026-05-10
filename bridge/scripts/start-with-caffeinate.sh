#!/usr/bin/env bash
# Start the Mana Hub Bridge wrapped in caffeinate so the Mac will not
# enter system idle sleep while the bridge is listening for messages.
#
# - caffeinate -i: prevent system idle sleep (display can still sleep)
# - exec replaces the shell so signals (SIGTERM/SIGINT) propagate cleanly

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "[start-with-caffeinate] bridge/.env is missing. Copy bridge/.env.example to bridge/.env and fill in real values."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[start-with-caffeinate] node_modules missing. Run 'npm install' inside bridge/ first."
  exit 1
fi

echo "[start-with-caffeinate] launching bridge under caffeinate -i"
exec /usr/bin/caffeinate -i npx tsx src/index.ts

#!/usr/bin/env bash
# Build safety app → Hostman /opt/queendar → replace performer portal on :3011
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${1:-hostman}"
REMOTE_DIR="${REMOTE_DIR:-/opt/queendar}"

cd "$ROOT"
if [ ! -f .env ]; then
  echo "✗ Missing .env with VITE_SUPABASE_*"
  exit 1
fi

echo "→ npm install + build"
npm install
npm run build

echo "→ stage deploy package"
STAGE="$(mktemp -d)"
cp -R "$ROOT/deploy/." "$STAGE/"
rm -rf "$STAGE/dist"
cp -R "$ROOT/dist" "$STAGE/dist"

echo "→ stop performer portal (kept at /opt/queendar-portal)"
ssh "$HOST" "docker stop queendar-portal 2>/dev/null || true; docker rm queendar-portal 2>/dev/null || true; mkdir -p $REMOTE_DIR"

echo "→ rsync to $HOST:$REMOTE_DIR"
rsync -az --delete \
  --exclude '.git' \
  "$STAGE/" "$HOST:$REMOTE_DIR/"

echo "→ build + start safety container on :3011"
ssh "$HOST" "cd $REMOTE_DIR && docker compose build && docker compose up -d --force-recreate"

echo "→ verify"
sleep 2
ssh "$HOST" "curl -sf http://127.0.0.1:3011/api/health; echo; curl -s http://127.0.0.1:3011/ | grep -oE '<title>[^<]+'"
curl -sf https://queendar.com/api/health && echo
curl -sL https://queendar.com/ | grep -oE '<title>[^<]+' || true

echo "✓ Queendar safety app live (portal backup remains at /opt/queendar-portal)"
rm -rf "$STAGE"

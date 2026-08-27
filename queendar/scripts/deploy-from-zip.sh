#!/usr/bin/env bash
# Extract Queendar zip → build → Hostman :3011
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZIP="${1:-$ROOT/../queendar-src-may.zip}"
WORK="${TMPDIR:-/tmp}/queendar-from-zip-$$"
HOST="${QUEENDAR_DEPLOY_HOST:-hostman}"
REMOTE_DIR="${REMOTE_DIR:-/opt/queendar}"

if [ ! -f "$ZIP" ]; then
  echo "✗ Zip not found: $ZIP"
  echo "  Usage: bash scripts/deploy-from-zip.sh /path/to/queendar.zip"
  exit 1
fi

echo "→ Using zip: $ZIP"
rm -rf "$WORK"
mkdir -p "$WORK"
unzip -o "$ZIP" -d "$WORK"
APP="$WORK/queendar"
test -f "$APP/package.json"

# Prefer existing .env; never require committing secrets
if [ -f "$ROOT/.env" ]; then
  cp "$ROOT/.env" "$APP/.env"
elif [ ! -f "$APP/.env" ]; then
  echo "✗ Need .env with VITE_SUPABASE_* (copy .env.example)"
  exit 1
fi

mkdir -p "$APP/deploy"
cp -R "$ROOT/deploy/." "$APP/deploy/"

cd "$APP"
npm install
npm run build

STAGE="$(mktemp -d)"
cp -R "$APP/deploy/." "$STAGE/"
rm -rf "$STAGE/dist"
cp -R "$APP/dist" "$STAGE/dist"
cp "$ZIP" "$STAGE/SOURCE-queendar.zip"

ssh "$HOST" "docker stop queendar-portal 2>/dev/null || true; docker rm queendar-portal 2>/dev/null || true; mkdir -p $REMOTE_DIR"
rsync -az --delete "$STAGE/" "$HOST:$REMOTE_DIR/"
ssh "$HOST" "cd $REMOTE_DIR && docker compose build && docker compose up -d --force-recreate"
sleep 2
curl -sf https://queendar.com/api/health; echo
curl -sL https://queendar.com/ | grep -oE '<title>[^<]+' || true
echo "✓ Deployed from zip"
rm -rf "$WORK" "$STAGE"

#!/usr/bin/env bash
# Deploy Queendar SPA + API to Hostman (queendar.com). Sticky is separate (getsticky.men).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${1:-hostman}"
REMOTE_DIR="${REMOTE_DIR:-/opt/queendar}"

cd "$ROOT"

echo "→ npm install + build"
npm install
npm run build

echo "→ stage SPA package"
STAGE="$(mktemp -d)"
cp -R "$ROOT/deploy/." "$STAGE/"
rm -rf "$STAGE/dist"
cp -R "$ROOT/dist" "$STAGE/dist"
mkdir -p "$STAGE/api"
cp "$ROOT/api/owner-auth.py" "$STAGE/api/owner-auth.py"

echo "→ stop old performer portal if present"
ssh "$HOST" "docker stop queendar-portal 2>/dev/null || true; docker rm queendar-portal 2>/dev/null || true; mkdir -p $REMOTE_DIR/app $REMOTE_DIR/data"

echo "→ rsync SPA container files → $HOST:$REMOTE_DIR"
rsync -az --delete \
  --exclude '.git' \
  --exclude 'api' \
  "$STAGE/" "$HOST:$REMOTE_DIR/"

echo "→ sync full app source (for rebuilds) + API"
rsync -az --delete \
  --exclude node_modules --exclude dist --exclude .env --exclude .git \
  "$ROOT/" "$HOST:$REMOTE_DIR/app/"
scp "$ROOT/api/owner-auth.py" "$HOST:$REMOTE_DIR/owner-auth.py"
scp "$ROOT/deploy/nginx/queendar.com.conf" "$HOST:/etc/nginx/sites-enabled/queendar.com.conf" 2>/dev/null || \
  scp "$ROOT/deploy/nginx/queendar.com.conf" "$HOST:/tmp/queendar.com.conf"

echo "→ rebuild SPA container on :3011"
ssh "$HOST" "cd $REMOTE_DIR && docker compose build && docker compose up -d --force-recreate"

echo "→ restart API (owner-auth) on :3019"
ssh "$HOST" "pkill -f '/opt/queendar/owner-auth.py' 2>/dev/null || true; nohup /usr/bin/python3 /opt/queendar/owner-auth.py >/var/log/queendar-api.log 2>&1 & sleep 1; curl -sf http://127.0.0.1:3019/api/health; echo; nginx -t && systemctl reload nginx"

echo "→ verify public"
sleep 2
curl -sf https://queendar.com/api/health && echo
curl -sL https://queendar.com/ | grep -oE '<title>[^<]+' || true

echo "✓ Queendar live at https://queendar.com (Sticky remains https://getsticky.men)"
rm -rf "$STAGE"

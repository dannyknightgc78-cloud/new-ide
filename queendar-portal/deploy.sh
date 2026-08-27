#!/bin/bash
set -e
HOST="${1:-hostman}"
REPAIR="${2:-}"
SRC="$(cd "$(dirname "$0")" && pwd)"
# Live path on Hostman is /opt/queendar-portal (CF tunnel / nginx → :3011)
REMOTE_DIR="${REMOTE_DIR:-/opt/queendar-portal}"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  QUEENDAR RUNS ON HOSTMAN — never docker compose on Mac  ║"
echo "║  Mac:     ~/projects/queendar-portal → ./deploy.sh hostman ║"
echo "║  Server:  /opt/queendar-portal → docker compose up -d     ║"
echo "║  AI:      host.docker.internal:18001 (cloudit-gpu coder) ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "Deploying $SRC → $HOST:$REMOTE_DIR/"
rsync -avz \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  "$SRC/" "$HOST:$REMOTE_DIR/"

if [[ "$REPAIR" == "--repair" ]]; then
  echo ""
  echo "Rebuilding on $HOST..."
  ssh "$HOST" "cd $REMOTE_DIR && docker compose build queendar && docker compose up -d --force-recreate queendar"
else
  echo ""
  echo "Next — rebuild on server so image picks up server/ changes:"
  echo "  ./deploy.sh $HOST --repair"
fi

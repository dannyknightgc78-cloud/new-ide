#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[queendar] Hostman + cloudit-gpu (Trooper retired)"
echo "  Expect host tunnels: systemd trooper-ai-tunnel → :18000/:18001"
echo "  AI_BASE_URL should be http://host.docker.internal:18001/v1"

if [[ ! -f .env ]]; then
  echo "Missing .env — copying from .env.example"
  cp .env.example .env
  echo "Set ADMIN_API_KEY, QUEEN_OPS_TOKEN, and optional TELEGRAM_* in .env then re-run"
  exit 1
fi

bash scripts/validate-env.sh

# Ensure host can resolve host.docker.internal from compose
if ! grep -q 'host.docker.internal' docker-compose.yml 2>/dev/null; then
  echo "WARN: docker-compose.yml missing extra_hosts host.docker.internal:host-gateway"
fi

echo "[queendar] docker compose up"
docker compose build
docker compose up -d --force-recreate
sleep 4
curl -sf "http://127.0.0.1:3011/api/health" | head -c 800 || true
echo ""
docker compose ps

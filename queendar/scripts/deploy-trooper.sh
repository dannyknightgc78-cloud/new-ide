#!/usr/bin/env bash
# Build on Mac → rsync to Trooper AI → serve on :8802 (Cloudflare tunnel target).
#
# Usage:
#   npm run deploy:trooper
#   npm run trooper:port          # find SSH port after reboot
#   LAB_SSH_PORT=36195 bash scripts/deploy-trooper.sh
#
# Tunnel (Trooper — test2 / a6e0b01c):
#   CLOUDFLARE_API_TOKEN=... bash scripts/apply-queendar-ingress.sh
#   → https://queendar.dannygc.cloud
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH_HOST="${TROOPER_HOST:-${LAB_SSH_HOST:-connect01.trooper.ai}}"
SSH_USER="${TROOPER_USER:-${LAB_SSH_USER:-trooperai}}"
SSH_PORT="${LAB_SSH_PORT:-${TROOPER_PORT:-}}"
REMOTE_DIR="${QUEENDAR_REMOTE_DIR:-queendar}"
APP_PORT="${QUEENDAR_PORT:-8802}"

if [ -z "$SSH_PORT" ]; then
  echo "→ Finding Trooper SSH port..."
  SSH_PORT="$(bash "$ROOT/scripts/find-trooper-port.sh" 2>/dev/null | awk '/OPEN:/{p=$2} END{print p}')"
fi
if [ -z "$SSH_PORT" ]; then
  echo "✗ No SSH port — run: npm run trooper:port"
  echo "  then: LAB_SSH_PORT=PORT npm run deploy:trooper"
  exit 1
fi

RSYNC=(rsync -az --delete -e "ssh -p ${SSH_PORT}")
SSH=(ssh -p "${SSH_PORT}" "${SSH_USER}@${SSH_HOST}")

echo "→ Queendar deploy → ${SSH_USER}@${SSH_HOST}:${SSH_PORT} ~/${REMOTE_DIR} :${APP_PORT}"

"${SSH[@]}" "echo ok" || {
  echo "✗ SSH failed — npm run trooper:port"
  exit 1
}

echo "→ build on Mac (VITE_* from .env)"
cd "$ROOT"
npm run build

echo "→ rsync dist + scripts"
"${SSH[@]}" "mkdir -p ~/${REMOTE_DIR}/dist ~/${REMOTE_DIR}/scripts"
"${RSYNC[@]}" "$ROOT/dist/" "${SSH_USER}@${SSH_HOST}:~/${REMOTE_DIR}/dist/"
"${RSYNC[@]}" "$ROOT/scripts/serve-queendar.py" "${SSH_USER}@${SSH_HOST}:~/${REMOTE_DIR}/scripts/"

echo "→ start on Trooper :${APP_PORT}"
"${SSH[@]}" bash -s <<REMOTE
set -euo pipefail
cd ~/${REMOTE_DIR}
PORT=${APP_PORT}
LOG="\$HOME/queendar.log"
pids=\$(lsof -ti ":\${PORT}" 2>/dev/null || true)
[ -n "\$pids" ] && kill \$pids 2>/dev/null || true
sleep 1
chmod +x scripts/serve-queendar.py
export QUEENDAR_PORT=\${PORT}
export QUEENDAR_BIND=127.0.0.1
nohup python3 scripts/serve-queendar.py >>"\$LOG" 2>&1 &
sleep 2
curl -sf "http://127.0.0.1:\${PORT}/" >/dev/null && echo "✓ Queendar on :\${PORT}" || { tail -20 "\$LOG"; exit 1; }
REMOTE

code=$("${SSH[@]}" "curl -sf -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:${APP_PORT}/" 2>/dev/null || echo FAIL)
echo "  Trooper :${APP_PORT} → HTTP ${code}"

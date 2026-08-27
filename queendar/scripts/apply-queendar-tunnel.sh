#!/usr/bin/env bash
# Wire queendar.dannygc.cloud → Trooper :8802 (local config + DNS + tunnel restart).
#
# Usage:
#   bash scripts/apply-queendar-tunnel.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH_HOST="${TROOPER_HOST:-${LAB_SSH_HOST:-connect01.trooper.ai}}"
SSH_USER="${TROOPER_USER:-${LAB_SSH_USER:-trooperai}}"
SSH_PORT="${LAB_SSH_PORT:-${TROOPER_PORT:-}}"
TUNNEL_ID="${CLOUDFLARE_TUNNEL_ID:-a6e0b01c-6fb3-4010-8083-6a8c32a76311}"
HOSTNAME="${QUEENDAR_HOSTNAME:-queendar.dannygc.cloud}"
APP_PORT="${QUEENDAR_PORT:-8802}"

if [ -z "$SSH_PORT" ]; then
  SSH_PORT="$(bash "$ROOT/scripts/find-trooper-port.sh" 2>/dev/null | awk '/OPEN:/{p=$2} END{print p}')"
fi
if [ -z "$SSH_PORT" ]; then
  echo "✗ Set LAB_SSH_PORT or run npm run trooper:port"
  exit 1
fi

SSH=(ssh -p "${SSH_PORT}" "${SSH_USER}@${SSH_HOST}")

echo "→ Trooper tunnel: ${HOSTNAME} → :${APP_PORT}"
"${SSH[@]}" "echo ok" || exit 1

"${SSH[@]}" bash -s <<REMOTE
set -euo pipefail
PORT=${APP_PORT}
HOSTNAME=${HOSTNAME}
TUNNEL_ID=${TUNNEL_ID}
CONF="\$HOME/.cloudflared/config.yml"
LAB_CONF="\$HOME/lab-dannygc/cloudflared/config.yml"

patch_config() {
  local f="\$1"
  [ -f "\$f" ] || return 0
  if grep -q "\$HOSTNAME" "\$f"; then
    echo "  ✓ \$HOSTNAME already in \$f"
    return 0
  fi
  python3 - "\$f" "\$HOSTNAME" "\$PORT" <<'PY'
import sys
path, hostname, port = sys.argv[1:4]
lines = open(path).read().splitlines()
out = []
inserted = False
for line in lines:
    if not inserted and line.strip().startswith("- service: http_status:"):
        out.append(f"  - hostname: {hostname}")
        out.append(f"    service: http://127.0.0.1:{port}")
        inserted = True
    out.append(line)
if not inserted:
    out.append(f"  - hostname: {hostname}")
    out.append(f"    service: http://127.0.0.1:{port}")
    out.append("  - service: http_status:404")
open(path, "w").write("\n".join(out) + "\n")
print(f"  ✓ added {hostname} → :{port} in {path}")
PY
}

echo "→ patch tunnel config"
patch_config "\$CONF"
patch_config "\$LAB_CONF"

echo "→ DNS CNAME via cloudflared"
if command -v cloudflared >/dev/null 2>&1; then
  cloudflared tunnel route dns "\$TUNNEL_ID" "\$HOSTNAME" -f 2>/dev/null && \
    echo "  ✓ DNS route \$HOSTNAME" || \
    echo "  ⚠ DNS route skipped (may already exist)"
else
  echo "  ⚠ cloudflared not in PATH"
fi

echo "→ restart tunnel"
pkill -f 'cloudflared tunnel' 2>/dev/null || true
sleep 2
if [ -x "\$HOME/lab-dannygc/scripts/start-tunnel.sh" ]; then
  bash "\$HOME/lab-dannygc/scripts/start-tunnel.sh" || true
else
  nohup cloudflared tunnel --config "\$CONF" run "\$TUNNEL_ID" >>"\$HOME/cloudflared.log" 2>&1 &
fi
sleep 4
pgrep -a cloudflared | head -1 || { echo "✗ tunnel not running"; exit 1; }
echo "  ✓ cloudflared running"

curl -sf "http://127.0.0.1:\${PORT}/" >/dev/null && echo "  ✓ app :\${PORT}" || echo "  ✗ app :\${PORT} down"
REMOTE

if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "→ sync remote tunnel API config"
  bash "$ROOT/scripts/apply-queendar-ingress.sh" || true
fi

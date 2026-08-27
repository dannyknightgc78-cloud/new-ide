#!/usr/bin/env bash
# Keep Queendar alive on Trooper after reboot (:8802).
#
# On Trooper:
#   bash scripts/install-queendar-cron.sh
# From Mac:
#   bash scripts/install-queendar-cron.sh --remote
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARKER="# queendar-keepalive"
REMOTE_DIR="${QUEENDAR_REMOTE_DIR:-queendar}"
APP_PORT="${QUEENDAR_PORT:-8802}"

install_local() {
  local script="$HOME/${REMOTE_DIR}/scripts/keep-queendar-alive.sh"
  mkdir -p "$HOME/${REMOTE_DIR}/scripts"
  cat >"$script" <<SCRIPT
#!/usr/bin/env bash
set -euo pipefail
PORT=${APP_PORT}
DIR="\$HOME/${REMOTE_DIR}"
if curl -sf --max-time 4 "http://127.0.0.1:\${PORT}/" >/dev/null; then
  exit 0
fi
[ -f "\$DIR/scripts/serve-queendar.py" ] || exit 0
pids=\$(lsof -ti ":\${PORT}" 2>/dev/null || true)
[ -n "\$pids" ] && kill \$pids 2>/dev/null || true
sleep 1
cd "\$DIR"
export QUEENDAR_PORT=\${PORT}
export QUEENDAR_BIND=127.0.0.1
nohup python3 scripts/serve-queendar.py >>"\$HOME/queendar.log" 2>&1 &
SCRIPT
  chmod +x "$script"

  TMP="$(mktemp)"
  crontab -l 2>/dev/null | grep -v "$MARKER" >"$TMP" || true
  echo "*/5 * * * * $script $MARKER" >>"$TMP"
  crontab "$TMP"
  rm -f "$TMP"
  echo "✓ queendar keepalive cron (every 5 min, :${APP_PORT})"
}

install_remote() {
  SSH_HOST="${TROOPER_HOST:-${LAB_SSH_HOST:-connect01.trooper.ai}}"
  SSH_USER="${TROOPER_USER:-${LAB_SSH_USER:-trooperai}}"
  SSH_PORT="${LAB_SSH_PORT:-${TROOPER_PORT:-}}"
  if [ -z "$SSH_PORT" ]; then
    SSH_PORT="$(bash "$ROOT/scripts/find-trooper-port.sh" 2>/dev/null | awk '/OPEN:/{p=$2} END{print p}')"
  fi
  ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" bash -s <<REMOTE
set -euo pipefail
MARKER="# queendar-keepalive"
PORT=${APP_PORT}
DIR="\$HOME/${REMOTE_DIR}"
mkdir -p "\$DIR/scripts"
cat >"\$DIR/scripts/keep-queendar-alive.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
PORT=${APP_PORT}
DIR="\$HOME/${REMOTE_DIR}"
if curl -sf --max-time 4 "http://127.0.0.1:\${PORT}/" >/dev/null; then exit 0; fi
[ -f "\$DIR/scripts/serve-queendar.py" ] || exit 0
pids=\$(lsof -ti ":\${PORT}" 2>/dev/null || true)
[ -n "\$pids" ] && kill \$pids 2>/dev/null || true
sleep 1
cd "\$DIR"
export QUEENDAR_PORT=\${PORT} QUEENDAR_BIND=127.0.0.1
nohup python3 scripts/serve-queendar.py >>"\$HOME/queendar.log" 2>&1 &
SCRIPT
chmod +x "\$DIR/scripts/keep-queendar-alive.sh"
TMP="\$(mktemp)"
crontab -l 2>/dev/null | grep -v "\$MARKER" >"\$TMP" || true
echo "*/5 * * * * \$DIR/scripts/keep-queendar-alive.sh \$MARKER" >>"\$TMP"
crontab "\$TMP"
rm -f "\$TMP"
echo "✓ queendar keepalive cron (every 5 min, :${APP_PORT})"
REMOTE
}

case "${1:-}" in
  --remote|-r) install_remote ;;
  *) install_local ;;
esac

#!/bin/bash
# Forward Trooper Ollama (:11434) to Vultr localhost for Queendar + other services.
set -euo pipefail

TROOPER_HOST="${TROOPER_HOST:-connect01.trooper.ai}"
TROOPER_USER="${TROOPER_USER:-trooperai}"
TROOPER_PORT="${TROOPER_PORT:-36195}"
TROOPER_SSH_KEY="${TROOPER_SSH_KEY:-/root/.ssh/id_rsa}"
LOCAL_PORT="${LOCAL_PORT:-11434}"
REMOTE_PORT="${REMOTE_PORT:-11434}"
PID_FILE="${PID_FILE:-/var/run/trooper-ai-tunnel.pid}"

SSH_OPTS=(-N -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -o BatchMode=yes)
SSH_OPTS+=(-i "$TROOPER_SSH_KEY" -p "$TROOPER_PORT")
SSH_OPTS+=(-L "0.0.0.0:${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}")

stop_tunnel() {
  if [[ -f "$PID_FILE" ]]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
  pkill -f "ssh.*${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}.*${TROOPER_HOST}" 2>/dev/null || true
}

start_tunnel() {
  stop_tunnel
  ssh "${SSH_OPTS[@]}" "${TROOPER_USER}@${TROOPER_HOST}" &
  echo $! > "$PID_FILE"
  sleep 1
  if ! curl -sf --max-time 6 "http://127.0.0.1:${LOCAL_PORT}/v1/models" >/dev/null; then
    echo "✗ Trooper AI tunnel up but /v1/models not responding"
    exit 1
  fi
  echo "✓ Trooper AI tunnel → 127.0.0.1:${LOCAL_PORT}"
}

case "${1:-start}" in
  start) start_tunnel ;;
  stop) stop_tunnel; echo "stopped" ;;
  restart) start_tunnel ;;
  status)
    if curl -sf --max-time 4 "http://127.0.0.1:${LOCAL_PORT}/v1/models" | head -c 120; then
      echo ""
      echo "✓ tunnel healthy"
    else
      echo "✗ tunnel down"
      exit 1
    fi
    ;;
  *) echo "usage: $0 {start|stop|restart|status}"; exit 1 ;;
esac

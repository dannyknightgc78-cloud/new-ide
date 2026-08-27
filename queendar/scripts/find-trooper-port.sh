#!/usr/bin/env bash
# Find which trooper public port accepts SSH (ports change after reboot).
HOST="${TROOPER_HOST:-connect01.trooper.ai}"
START="${TROOPER_PORT_START:-36183}"
END="${TROOPER_PORT_END:-36200}"

echo "Scanning ${HOST} ports ${START}-${END} ..."
OPEN=""
for port in $(seq "$START" "$END"); do
  if nc -z -w 2 "$HOST" "$port" 2>/dev/null; then
    echo "  OPEN: $port"
    OPEN="$port"
  fi
done

if [ -z "$OPEN" ]; then
  echo ""
  echo "No open ports found. Check Trooper dashboard → Firewall → Allow your Mac IP."
  exit 1
fi

echo ""
echo "Deploy with:"
echo "  LAB_SSH_PORT=$OPEN npm run deploy:trooper"

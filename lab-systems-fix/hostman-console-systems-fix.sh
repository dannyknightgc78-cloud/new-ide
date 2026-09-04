#!/usr/bin/env bash
# Paste into Hostman web console (root) on cloudit1 / lab host.
# Nimbus Urge recovery: Aegis/protect 502, watchdog down, GhostGrid OFFLINE,
# stalled probes, missing dual RTX panels.
set -euo pipefail

echo "=== Nimbus Urge · Aegis · GhostGrid · dual RTX · probes ==="
date -u
hostname
uname -a

BRANCH="${LAB_SYSTEMS_FIX_BRANCH:-cursor/ghostgrid-probes-rtx-f89d}"
REPO_RAW="https://raw.githubusercontent.com/dannyknightgc78-cloud/new-ide/${BRANCH}/lab-systems-fix"
WORK="/tmp/lab-systems-fix-$$"
mkdir -p "$WORK"
cd "$WORK"

echo "==> Fetch fix package"
for f in ghostgrid_fast_load.py dual_gpu_status.py patch_carl_ops.py diagnose.sh nimbus_urge_check.py; do
  curl -fsSL "$REPO_RAW/$f" -o "$f"
done
chmod +x diagnose.sh patch_carl_ops.py nimbus_urge_check.py

# Authorize Cursor cloud agent SSH keys (idempotent)
echo "==> Authorize Cursor agent SSH keys"
mkdir -p /root/.ssh && chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys
for PUB in \
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGh5uzhhDMuW+reaCiInxGD2EetWAK+QyxnW0TFnvxeu cursor-cloud-agent' \
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFFWu6tW6vP2CYNp0CQn5lUSXB5Zitu/SrP5EQewx5Yc cursor-cloud-agent-recovery'
do
  grep -qF "$PUB" /root/.ssh/authorized_keys || echo "$PUB" >> /root/.ssh/authorized_keys
done

echo "==> Pre-flight Nimbus Urge"
python3 nimbus_urge_check.py || true

echo "==> GPU inventory"
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi -L || true
  nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total --format=csv || true
else
  echo "nvidia-smi not on this host — dual GPU inferred from ai.dannygc.cloud / rtx-pro peer"
fi

echo "==> Listening ports (GhostGrid 8810/8811, systems-agent 8788, Aegis/protect)"
ss -lntp 2>/dev/null | grep -E ':8810|:8811|:8788|:4173|:8000|:8080|:8090|:9000|:11434|:18001' || true

restart_unit() {
  local u="$1"
  if systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}' | grep -qx "${u}.service" \
    || systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}' | grep -qx "${u}" \
    || systemctl cat "$u" >/dev/null 2>&1; then
    systemctl enable "$u" 2>/dev/null || true
    systemctl restart "$u" && echo "restarted $u" || echo "failed $u"
  else
    echo "skip (no unit): $u"
  fi
}

echo "==> Restart core units (watchdog + Aegis/protect first — Nimbus infra.watchdog was down)"
for u in \
  nimbus-watchdog watchdog systems-watchdog \
  nimbus-watchdog.service watchdog.service \
  aegis protect aegis-protect protect-api \
  aegis.service protect.service \
  ghostgrid ghostgrid-abx \
  carl-ops lab-dannygc systems-agent \
  nimbus nimbus-live \
  cloudflared nginx
do
  restart_unit "$u" || true
done

echo "==> Bring systems-agent back on :8788 (screenshot: Host stats unavailable / Systems API 502)"
# Kill stuck listeners that accept then hang (causes Cloudflare 502 on /api/ops/*)
if command -v fuser >/dev/null 2>&1; then
  fuser -k 8788/tcp 2>/dev/null || true
fi
pkill -f 'systems-agent|systems:agent|ops-agent.*8788' 2>/dev/null || true
sleep 1

# Locate package.json that defines systems:agent
AGENT_DIR=""
for cand in \
  /root/lab-dannygc /opt/lab-dannygc /var/www/lab-dannygc \
  /root/carl-ops /opt/carl-ops /root/systems-agent /opt/systems-agent \
  /root/trooper /opt/trooper /home/*/lab-dannygc /home/*/projects/dannygc/*
do
  # shellcheck disable=SC2086
  for pkg in $cand/package.json $cand/*/package.json; do
    [[ -f "$pkg" ]] || continue
    if grep -q 'systems:agent\|"systems-agent"' "$pkg" 2>/dev/null; then
      AGENT_DIR=$(dirname "$pkg")
      break 2
    fi
  done
done

start_systems_agent() {
  local dir="$1"
  echo "systems-agent package at $dir"
  cd "$dir"
  if [[ -f package-lock.json ]]; then npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts 2>/dev/null || true
  else npm install --ignore-scripts 2>/dev/null || true
  fi
  # Prefer systemd unit we install below; also start now in background
  nohup npm run systems:agent > /var/log/systems-agent.log 2>&1 &
  echo $! > /run/systems-agent.pid
  sleep 2
  cd "$WORK"
}

if [[ -n "$AGENT_DIR" ]]; then
  start_systems_agent "$AGENT_DIR"
  # Persist via systemd if missing
  if ! systemctl cat systems-agent >/dev/null 2>&1; then
    cat > /etc/systemd/system/systems-agent.service <<EOF
[Unit]
Description=Lab systems-agent (:8788)
After=network.target

[Service]
Type=simple
WorkingDirectory=${AGENT_DIR}
ExecStart=/usr/bin/npm run systems:agent
Restart=always
RestartSec=5
Environment=PORT=8788
Environment=HOST=0.0.0.0

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable --now systems-agent
    echo "installed systemd systems-agent.service"
  else
    systemctl restart systems-agent || start_systems_agent "$AGENT_DIR"
  fi
else
  echo "WARNING: no package.json with systems:agent found — create/start manually: npm run systems:agent"
fi

# Verify :8788
if curl -sf -m 3 http://127.0.0.1:8788/api/health >/dev/null 2>&1 \
  || curl -sf -m 3 http://127.0.0.1:8788/health >/dev/null 2>&1; then
  echo "systems-agent OK on :8788"
else
  echo "WARNING: :8788 still not responding — ops routes will keep 502/timeout"
  ss -lntp | grep 8788 || true
  tail -n 40 /var/log/systems-agent.log 2>/dev/null || true
fi

# carl-ops hung workers often cause /api/ops/* Cloudflare 502 — bounce after agent is up
restart_unit carl-ops || true
restart_unit lab-dannygc || true

# Also match any unit name containing these tokens
echo "==> Scan systemd for matching units"
systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}' \
  | grep -Ei 'watchdog|aegis|protect|ghostgrid|carl-ops|systems-agent|nimbus' \
  | while read -r u; do
      restart_unit "${u%.service}" || true
    done || true

# Docker compose stacks under common roots
for dir in /root/lab-dannygc /opt/lab-dannygc /root/ghostgrid /opt/ghostgrid /root/aegis /opt/aegis /root/protect /opt/protect /root/nimbus /opt/nimbus; do
  if [[ -f "$dir/docker-compose.yml" || -f "$dir/compose.yml" ]]; then
    echo "==> docker compose up -d in $dir"
    (cd "$dir" && (docker compose up -d --remove-orphans || docker-compose up -d) || true)
  fi
done

echo "==> Fix nginx /protect/ proxy for Aegis Station (lab.dannygc.cloud/protect/api → 502)"
# Discover local Aegis/protect upstream
AEGIS_PORT=""
for p in 8090 9000 8089 8812 7000 8001; do
  if curl -sf -m 1 "http://127.0.0.1:${p}/health" >/dev/null 2>&1 \
    || curl -sf -m 1 "http://127.0.0.1:${p}/api/health" >/dev/null 2>&1 \
    || curl -sf -m 1 "http://127.0.0.1:${p}/protocol/status" >/dev/null 2>&1; then
    AEGIS_PORT="$p"
    echo "found local Aegis-like service on :$p"
    break
  fi
done
# Also check docker published ports
if [[ -z "$AEGIS_PORT" ]] && command -v docker >/dev/null 2>&1; then
  docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -Ei 'aegis|protect' || true
fi

NGINX_FIX="/etc/nginx/conf.d/lab-protect-aegis.conf"
if [[ -n "$AEGIS_PORT" ]]; then
  cat > "$NGINX_FIX" <<EOF
# lab-systems-fix — Aegis Station under /protect/api
location /protect/api/ {
    proxy_pass http://127.0.0.1:${AEGIS_PORT}/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 30s;
}
location = /protect/api {
    return 301 /protect/api/;
}
EOF
  nginx -t && systemctl reload nginx && echo "nginx /protect/api → :${AEGIS_PORT}" || echo "nginx reload failed"
else
  echo "WARNING: no local Aegis port found — ensure protect.dannygc.cloud origin is healthy"
  echo "         and that lab nginx proxies /protect/ to it (currently 502)."
  # Soft fallback: proxy to protect.dannygc.cloud origin if DNS resolves locally
  if getent hosts protect.dannygc.cloud >/dev/null 2>&1; then
    cat > "$NGINX_FIX" <<'EOF'
# lab-systems-fix — fallback proxy to protect.dannygc.cloud
location /protect/api/ {
    proxy_pass https://protect.dannygc.cloud/api/;
    proxy_ssl_server_name on;
    proxy_http_version 1.1;
    proxy_set_header Host protect.dannygc.cloud;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
}
location = /protect/api {
    return 301 /protect/api/;
}
EOF
    nginx -t && systemctl reload nginx && echo "nginx /protect/api → protect.dannygc.cloud/api/" || true
  fi
fi

echo "==> Patch carl-ops source tree (fast GhostGrid + dual GPU)"
ROOT=""
for cand in /root/lab-dannygc /opt/lab-dannygc /var/www/lab-dannygc /root/carl-ops /opt/carl-ops; do
  if [[ -d "$cand" ]]; then ROOT="$cand"; break; fi
done
if [[ -n "$ROOT" ]]; then
  python3 patch_carl_ops.py --root "$ROOT" || true
  pip3 install -q httpx 2>/dev/null || pip install -q httpx 2>/dev/null || true
  for u in carl-ops lab-dannygc systems-agent ghostgrid ghostgrid-abx; do
    restart_unit "$u" || true
  done
else
  echo "WARNING: lab-dannygc source not found — helpers in $WORK only"
fi

echo "==> cloudsit.app public DOWNs (tunnel) — soft restart cloudflared only"
systemctl restart cloudflared 2>/dev/null || true
# If a second tunnel service exists for cloudsit
systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}' \
  | grep -Ei 'cloudflare|tunnel|cloudsit' \
  | while read -r u; do restart_unit "${u%.service}" || true; done || true

echo "==> Local smoke"
python3 - <<'PY'
import time, json
from ghostgrid_fast_load import build_ghostgrid_load_sync
from dual_gpu_status import build_gpu_dashboard
t0=time.perf_counter()
gg=build_ghostgrid_load_sync()
print('ghostgrid', round(time.perf_counter()-t0,3), 's online=', gg.get('online'))
dash=build_gpu_dashboard()
print('dual_gpu', dash.get('dual_gpu'), 'panels', len((dash.get('gpu') or {}).get('panels') or []))
PY

echo "==> External verify"
sleep 3
for url in \
  "https://lab.dannygc.cloud/protect/api/health" \
  "https://protect.dannygc.cloud/api/protocol/status" \
  "https://lab.dannygc.cloud/api/ops/ghostgrid/load" \
  "https://lab.dannygc.cloud/api/ops/services/dashboard" \
  "https://lab.dannygc.cloud/api/ops/empire/nodes" \
  "https://lab.dannygc.cloud/api/ops/services/registry" \
  "https://lab.dannygc.cloud/api/ops/servers/local" \
  "http://127.0.0.1:8788/api/health" \
  "https://ghostgrid.dannygc.cloud/api/health" \
  "https://nimbus.dannygc.cloud/api/health"
do
  curl -sS -m 12 -o /tmp/vbody -w "%{http_code} %{time_total}s ${url}\n" "$url" || echo "FAIL $url"
done

python3 nimbus_urge_check.py || true

echo
echo "=== Done ==="
echo "Refresh https://lab.dannygc.cloud/systems  and  https://nimbus.dannygc.cloud/urge"
echo "Expect: Aegis online, GhostGrid LIVE, dual RTX #0/#1, watchdog active."

#!/usr/bin/env bash
# Paste into Hostman web console (root) on cloudit1 / lab host.
# Fixes: GhostGrid OFFLINE on /systems, stalled probes, missing dual RTX panels, Aegis 502.
set -euo pipefail

echo "=== Lab systems fix — GhostGrid · probes · dual RTX · Aegis ==="
date -u
hostname
uname -a

BRANCH="${LAB_SYSTEMS_FIX_BRANCH:-cursor/ghostgrid-probes-rtx-f89d}"
REPO_RAW="https://raw.githubusercontent.com/dannyknightgc78-cloud/new-ide/${BRANCH}/lab-systems-fix"
WORK="/tmp/lab-systems-fix-$$"
mkdir -p "$WORK"
cd "$WORK"

echo "==> Fetch fix package"
for f in ghostgrid_fast_load.py dual_gpu_status.py patch_carl_ops.py diagnose.sh; do
  curl -fsSL "$REPO_RAW/$f" -o "$f"
done
chmod +x diagnose.sh patch_carl_ops.py

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

echo "==> GPU inventory"
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi -L || true
  nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total --format=csv || true
else
  echo "nvidia-smi not on this host — dual GPU will be inferred from ai.dannygc.cloud peer"
fi

echo "==> Listening ports (GhostGrid 8810/8811, systems-agent 8788, Aegis/protect)"
ss -lntp 2>/dev/null | grep -E ':8810|:8811|:8788|:4173|:8000|:8080|:11434|:18001' || true

echo "==> Restart GhostGrid / ABX / Aegis / systems-agent units if present"
restart_unit() {
  local u="$1"
  if systemctl list-unit-files 2>/dev/null | grep -q "^${u}"; then
    systemctl restart "$u" && echo "restarted $u" || echo "failed $u"
  elif systemctl status "$u" >/dev/null 2>&1; then
    systemctl restart "$u" && echo "restarted $u" || echo "failed $u"
  else
    echo "skip (no unit): $u"
  fi
}
for u in \
  ghostgrid ghostgrid-abx ghostgrid.service ghostgrid-abx.service \
  carl-ops carl-ops.service lab-dannygc lab-dannygc.service \
  systems-agent systems-agent.service \
  aegis aegis.service protect protect.service nimbus nimbus.service \
  cloudflared nginx
do
  restart_unit "$u" || true
done

# Docker compose stacks under common roots
for dir in /root/lab-dannygc /opt/lab-dannygc /root/ghostgrid /opt/ghostgrid; do
  if [[ -f "$dir/docker-compose.yml" || -f "$dir/compose.yml" ]]; then
    echo "==> docker compose restart in $dir"
    (cd "$dir" && docker compose restart || docker-compose restart || true)
  fi
done

echo "==> Patch carl-ops source tree"
ROOT=""
for cand in /root/lab-dannygc /opt/lab-dannygc /var/www/lab-dannygc /root/carl-ops /opt/carl-ops; do
  if [[ -d "$cand" ]]; then ROOT="$cand"; break; fi
done
if [[ -n "$ROOT" ]]; then
  python3 patch_carl_ops.py --root "$ROOT" || true
  # Prefer pip httpx for async client
  pip3 install -q httpx 2>/dev/null || pip install -q httpx 2>/dev/null || true
  # Restart again after patch
  for u in carl-ops lab-dannygc systems-agent ghostgrid ghostgrid-abx; do
    restart_unit "$u" || true
  done
else
  echo "WARNING: lab-dannygc source not found — copied helpers to $WORK only"
  echo "Locate the FastAPI app and: python3 patch_carl_ops.py --root /path"
fi

echo "==> Local smoke (fast GhostGrid aggregator)"
python3 - <<'PY'
import time, json
from ghostgrid_fast_load import build_ghostgrid_load_sync
from dual_gpu_status import build_gpu_dashboard
t0=time.perf_counter()
gg=build_ghostgrid_load_sync()
print('ghostgrid', round(time.perf_counter()-t0,3), 's', 'online=', gg.get('online'), 'detail=', gg.get('detail'))
print(json.dumps({k: gg.get(k) for k in ('online','adversarial_events','drift_alerts','tamper')}, indent=2))
dash=build_gpu_dashboard()
print('dual_gpu', dash.get('dual_gpu'), 'panels', len((dash.get('gpu') or {}).get('panels') or []))
PY

echo "==> External endpoint checks"
sleep 2
curl -sS -m 5 -o /tmp/ggh.json -w "ghostgrid health %{http_code} %{time_total}s\n" https://ghostgrid.dannygc.cloud/api/health || true
curl -sS -m 8 -o /tmp/ggl.json -w "lab ghostgrid/load %{http_code} %{time_total}s\n" https://lab.dannygc.cloud/api/ops/ghostgrid/load || true
curl -sS -m 15 -o /tmp/dash.json -w "lab dashboard %{http_code} %{time_total}s\n" https://lab.dannygc.cloud/api/ops/services/dashboard || true
curl -sS -m 5 -o /tmp/aegis.json -w "aegis protect %{http_code} %{time_total}s\n" https://lab.dannygc.cloud/protect/api/health || true

python3 - <<'PY'
import json, pathlib
for name in ("ggl.json","dash.json","aegis.json","ggh.json"):
    p=pathlib.Path('/tmp')/name
    if not p.exists() or p.stat().st_size==0:
        print(name, 'empty')
        continue
    try:
        d=json.loads(p.read_text())
    except Exception as e:
        print(name, 'non-json', e)
        continue
    if name=='ggl.json':
        print('load online=', d.get('online'), 'honeypot=', (d.get('honeypot') or {}).get('online'), 'abx=', (d.get('abx') or {}).get('online'))
    elif name=='dash.json':
        panels=((d.get('gpu') or {}).get('panels')) or []
        print('dashboard ok=', d.get('ok'), 'error=', d.get('error'), 'panels=', len(panels), 'dual=', len(panels)>=2)
    elif name=='aegis.json':
        print('aegis', d)
    else:
        print('gg health', d.get('ok'), d.get('service'))
PY

echo
echo "=== Done ==="
echo "Refresh https://lab.dannygc.cloud/systems"
echo "Expect: GhostGrid LIVE, dual RTX panels #0/#1, Aegis health 200 (if protect unit exists)."
echo "If adversarial probes still 500: check journalctl -u ghostgrid -n 100"

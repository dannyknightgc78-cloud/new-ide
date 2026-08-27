#!/bin/bash
# Add queendar.dannygc.cloud to Vultr Cloudflare tunnel (78b509d8).
# Requires: export CLOUDFLARE_API_TOKEN='...'  (Account → Cloudflare Tunnel Edit)
set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-8135e527d5a9f3fa8f993c358bb1a90f}"
TUNNEL_ID="${CLOUDFLARE_TUNNEL_ID:-78b509d8-0a28-4cd6-a0b8-1c9dd8dbcfaf}"
HOSTNAME="queendar.dannygc.cloud"
SERVICE="${QUEENDAR_ORIGIN:-http://queendar-portal:3011}"

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Missing CLOUDFLARE_API_TOKEN."
  echo ""
  echo "Manual: Zero Trust → Networks → Tunnels → cloud-me → Public Hostname"
  echo "  Hostname: ${HOSTNAME}"
  echo "  Service:  ${SERVICE}"
  exit 1
fi

python3 - "$ACCOUNT_ID" "$TUNNEL_ID" "$HOSTNAME" "$SERVICE" <<'PY'
import json, os, sys, urllib.request

account, tunnel_id, hostname, service = sys.argv[1:5]
token = os.environ["CLOUDFLARE_API_TOKEN"]
base = f"https://api.cloudflare.com/client/v4/accounts/{account}/cfd_tunnel/{tunnel_id}/configurations"

def api(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method=method,
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode())

resp = api("GET", base)
cfg = (resp.get("result") or {}).get("config") or {}
ingress = list(cfg.get("ingress") or [])
if any(r.get("hostname") == hostname for r in ingress):
    print(f"Already present: {hostname}")
    sys.exit(0)

catch_idx = next((i for i, r in enumerate(ingress) if str(r.get("service", "")).startswith("http_status:")), len(ingress))
ingress.insert(catch_idx, {"hostname": hostname, "service": service})
put_body = {"config": {"ingress": ingress}}
if "warp-routing" in cfg:
    put_body["config"]["warp-routing"] = cfg["warp-routing"]
put = api("PUT", base, put_body)
if not put.get("success"):
    print(json.dumps(put, indent=2))
    sys.exit(1)
print(f"OK — added {hostname} → {service}")
PY

sleep 5
curl -sS -o /dev/null -w "https://${HOSTNAME}/api/health → HTTP %{http_code}\n" --max-time 20 "https://${HOSTNAME}/api/health" || true

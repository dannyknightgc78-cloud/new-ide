#!/usr/bin/env bash
# Cloudflare tunnel (Trooper test2): queendar.dannygc.cloud → http://127.0.0.1:8802
# Also ensures proxied DNS CNAME to the tunnel.
#
# Requires CLOUDFLARE_API_TOKEN (Account → Cloudflare Tunnel Edit + DNS Edit)
#   export CLOUDFLARE_API_TOKEN=...
#   bash scripts/apply-queendar-ingress.sh
#
# Manual (Zero Trust → Tunnels → test2 → Public Hostname):
#   queendar.dannygc.cloud → http://127.0.0.1:8802
# DNS: queendar CNAME → a6e0b01c-6fb3-4010-8083-6a8c32a76311.cfargotunnel.com (proxied)
set -euo pipefail

TUNNEL_ID="${CLOUDFLARE_TUNNEL_ID:-a6e0b01c-6fb3-4010-8083-6a8c32a76311}"
ACCOUNT="${CLOUDFLARE_ACCOUNT_ID:-8135e527d5a9f3fa8f993c358bb1a90f}"
PORT="${QUEENDAR_PORT:-8802}"
HOSTNAME="${QUEENDAR_HOSTNAME:-queendar.dannygc.cloud}"
ZONE="${QUEENDAR_ZONE:-dannygc.cloud}"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "✗ CLOUDFLARE_API_TOKEN required for first public deploy"
  echo ""
  echo "  export CLOUDFLARE_API_TOKEN=your_token"
  echo "  bash scripts/apply-queendar-ingress.sh"
  echo ""
  echo "Or manually in Cloudflare dashboard:"
  echo "  Tunnel test2: ${HOSTNAME} → http://127.0.0.1:${PORT}"
  echo "  DNS ${ZONE}: queendar CNAME → ${TUNNEL_ID}.cfargotunnel.com (proxied)"
  exit 1
fi

python3 - "$TUNNEL_ID" "$ACCOUNT" "$HOSTNAME" "$PORT" "$ZONE" <<'PY'
import json, os, sys, urllib.request, urllib.parse

tunnel_id, account, hostname, port, zone_name = sys.argv[1:6]
token = os.environ["CLOUDFLARE_API_TOKEN"]
service = f"http://127.0.0.1:{port}"
desired = {"hostname": hostname, "service": service}
tunnel_cname = f"{tunnel_id}.cfargotunnel.com"
record_name = hostname.removesuffix(f".{zone_name}") if hostname.endswith(f".{zone_name}") else hostname

def api(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method=method,
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode())

# --- tunnel ingress ---
base = f"https://api.cloudflare.com/client/v4/accounts/{account}/cfd_tunnel/{tunnel_id}/configurations"
remote = (api("GET", base).get("result") or {}).get("config") or {}
ingress = list(remote.get("ingress") or [])
if not ingress:
    raise SystemExit("No remote ingress — configure tunnel in dashboard first")

merged = [dict(r) for r in ingress if r.get("hostname") != hostname]
catch = None
if merged and str(merged[-1].get("service", "")).startswith("http_status:"):
    catch = merged.pop()
merged.append(dict(desired))
if catch:
    merged.append(catch)
else:
    merged.append({"service": "http_status:404"})

body = {"config": {"ingress": merged}}
if "warp-routing" in remote:
    body["config"]["warp-routing"] = remote["warp-routing"]
api("PUT", base, body)
print(f"✓ Tunnel ingress — {hostname} → :{port}")

# --- DNS CNAME ---
zones = api("GET", f"https://api.cloudflare.com/client/v4/zones?name={urllib.parse.quote(zone_name)}")
zone_list = zones.get("result") or []
if not zone_list:
    raise SystemExit(f"Zone not found: {zone_name}")
zone_id = zone_list[0]["id"]

existing = api(
    "GET",
    f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records?name={urllib.parse.quote(hostname)}",
).get("result") or []

dns_body = {
    "type": "CNAME",
    "name": record_name,
    "content": tunnel_cname,
    "proxied": True,
    "ttl": 1,
}

if existing:
    rec_id = existing[0]["id"]
    if existing[0].get("type") == "CNAME" and existing[0].get("content", "").rstrip(".") == tunnel_cname:
        print(f"✓ DNS already correct — {hostname}")
    else:
        api("PUT", f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{rec_id}", dns_body)
        print(f"✓ DNS updated — {hostname} → {tunnel_cname}")
else:
    api("POST", f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records", dns_body)
    print(f"✓ DNS created — {hostname} → {tunnel_cname}")
PY

echo "→ waiting for edge propagation..."
sleep 8
title=$(curl -sS --max-time 20 "https://${HOSTNAME}/" 2>/dev/null | grep -oE '<title>[^<]+</title>' | head -1)
if echo "$title" | grep -qi queendar; then
  echo "✓ Public URL live — ${title}"
else
  echo "⚠ Public URL not serving Queendar yet — ${title:-no response}"
  echo "  Tunnel + DNS updated; allow up to 2 minutes for propagation"
fi

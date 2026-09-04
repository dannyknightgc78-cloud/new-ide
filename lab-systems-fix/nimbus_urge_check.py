#!/usr/bin/env python3
"""Nimbus Urge checker — pull https://nimbus.dannygc.cloud/api/status and
classify what to fix for Aegis / GhostGrid / dual RTX / lattice.

Usage:
  python3 nimbus_urge_check.py
  python3 nimbus_urge_check.py --json
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from collections import Counter
from typing import Any

NIMBUS_STATUS = "https://nimbus.dannygc.cloud/api/status"

# Surfaces the /systems Ops Command + Aegis Station actually depend on.
CRITICAL_HOSTS = {
    "lab.dannygc.cloud",
    "systems.dannygc.cloud",
    "protect.dannygc.cloud",
    "ghostgrid.dannygc.cloud",
    "nimbus.dannygc.cloud",
    "ai.dannygc.cloud",
    "hub.dannygc.cloud",
    "genie.dannygc.cloud",
    "carl.dannygc.cloud",
    "butler.dannygc.cloud",
    "sentinel.dannygc.cloud",
    "monitor.dannygc.cloud",
    "haven.dannygc.cloud",
}


def fetch_status(url: str = NIMBUS_STATUS, timeout: float = 20.0) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "nimbus-urge-check/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
            return json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception:
        import subprocess

        out = subprocess.check_output(
            ["curl", "-fsS", "--max-time", str(int(timeout)), url],
            text=True,
        )
        return json.loads(out)


def live_probe(url: str, timeout: float = 10.0) -> tuple[int, float]:
    import subprocess
    import time

    t0 = time.perf_counter()
    try:
        code = subprocess.check_output(
            ["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", str(int(timeout)), url],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        return int(code or 0), time.perf_counter() - t0
    except Exception:
        return 0, time.perf_counter() - t0


def analyze(status: dict[str, Any]) -> dict[str, Any]:
    sites = status.get("sites") or []
    by_status = Counter(s.get("status") for s in sites)
    down = [s for s in sites if s.get("status") in {"DOWN", "ORIGIN_DOWN"}]
    check = [s for s in sites if s.get("status") == "CHECK"]
    critical_issues = [
        s for s in sites if s.get("host") in CRITICAL_HOSTS and s.get("status") != "OK"
    ]

    infra = status.get("infra") or {}
    infra_bad = {k: v for k, v in infra.items() if str(v).lower() in {"down", "inactive", "failed", "dead", "0", "off"}}

    servers = status.get("servers") or []
    rtx = next((s for s in servers if "rtx" in str(s.get("id", "")).lower() or "rtx" in str(s.get("label", "")).lower()), None)

    # Live probes that Nimbus site list may miss (path-level)
    live = {}
    for name, url in [
        ("aegis_lab_protect", "https://lab.dannygc.cloud/protect/api/health"),
        ("aegis_protect_protocol", "https://protect.dannygc.cloud/api/protocol/status"),
        ("ghostgrid_load", "https://lab.dannygc.cloud/api/ops/ghostgrid/load"),
        ("services_dashboard", "https://lab.dannygc.cloud/api/ops/services/dashboard"),
        ("empire_nodes", "https://lab.dannygc.cloud/api/ops/empire/nodes"),
        ("services_registry", "https://lab.dannygc.cloud/api/ops/services/registry"),
        ("servers_local", "https://lab.dannygc.cloud/api/ops/servers/local"),
        ("ghostgrid_pulse", "https://ghostgrid.dannygc.cloud/api/ghostgrid/adversarial/pulse"),
        ("monitor", "https://monitor.dannygc.cloud/"),
        ("nimbus_health", "https://nimbus.dannygc.cloud/api/health"),
        ("genie_health", "https://genie.dannygc.cloud/api/health"),
        ("ai_models", "https://ai.dannygc.cloud/v1/models"),
    ]:
        slow = name in {"ghostgrid_load", "services_dashboard", "empire_nodes", "services_registry", "servers_local"}
        code, secs = live_probe(url, timeout=12 if slow else 8)
        ok = code in {200, 401}  # 401 = up but auth-gated
        # hung ops routes → Cloudflare 502 / browser "Systems API 502"
        live[name] = {"http": code, "sec": round(secs, 3), "ok": ok and secs < 12}

    actions: list[str] = []
    if infra.get("watchdog") == "down" or "watchdog" in infra_bad:
        actions.append("Restart nimbus-watchdog / systems-agent (infra.watchdog=down)")
    hung_ops = [k for k in ("empire_nodes", "services_registry", "servers_local", "services_dashboard", "ghostgrid_load") if not live[k]["ok"]]
    if hung_ops:
        actions.append(
            "systems-agent offline / hung ops API ("
            + ", ".join(hung_ops)
            + ") — run npm run systems:agent on :8788; bounce carl-ops (screenshot: Systems API 502, 1/6 live)"
        )
    if not live["aegis_lab_protect"]["ok"]:
        actions.append("Fix nginx proxy lab.dannygc.cloud/protect/ → Aegis (currently 502); restart aegis/protect unit")
    if not live["ghostgrid_load"]["ok"]:
        actions.append("Apply ghostgrid_fast_load patch — /api/ops/ghostgrid/load too slow for SPA")
    if not live["services_dashboard"]["ok"]:
        actions.append("Apply dual_gpu_status + shorten dashboard probe timeouts (CLOUDIT-GPU / dual RTX)")
    if live.get("ai_models", {}).get("ok") and not live["services_dashboard"]["ok"]:
        actions.append("ai.dannygc.cloud/v1/models is OK — dual RTX peer alive; lab dashboard probes are the failure")
    if not live["ghostgrid_pulse"]["ok"]:
        actions.append("Repair GhostGrid /api/ghostgrid/adversarial/* (500) — probes/warroom pulse")
    if not live["monitor"]["ok"]:
        actions.append("Restore monitor.dannygc.cloud (Netdata) tunnel/route")
    cloudsit_down = [s["host"] for s in down if str(s.get("host", "")).endswith("cloudsit.app")]
    if cloudsit_down:
        actions.append(f"cloudsit.app tunnel/DNS: {len(cloudsit_down)} public DOWN (local often OK) — restart cloudflared for cloudsit")

    return {
        "updated_at": status.get("updated_at"),
        "health_score": status.get("health_score"),
        "summary": status.get("summary"),
        "by_status": dict(by_status),
        "infra": infra,
        "infra_bad": infra_bad,
        "rtx_server": rtx,
        "critical_site_issues": critical_issues,
        "down_count": len(down),
        "check_count": len(check),
        "cloudsit_down": len(cloudsit_down),
        "live_probes": live,
        "actions": actions,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--url", default=NIMBUS_STATUS)
    args = ap.parse_args()

    status = fetch_status(args.url)
    report = analyze(status)
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"Nimbus Urge @ {report['updated_at']}  health_score={report.get('health_score')}")
        print(f"sites: {report['by_status']}")
        print(f"infra: {report['infra']}")
        if report["infra_bad"]:
            print(f"infra BAD: {report['infra_bad']}")
        rtx = report.get("rtx_server")
        if rtx:
            print(f"RTX: {rtx.get('label')} status={rtx.get('status')} detail={rtx.get('detail')}")
        print("\nLive probes:")
        for k, v in report["live_probes"].items():
            flag = "OK " if v["ok"] else "BAD"
            print(f"  {flag}  {k:28} HTTP {v['http']}  {v['sec']}s")
        print("\nActions:")
        for a in report["actions"] or ["None — critical lattice looks healthy"]:
            print(f"  • {a}")
        print("\nApply on Hostman:")
        print("  curl -fsSL https://raw.githubusercontent.com/dannyknightgc78-cloud/new-ide/cursor/ghostgrid-probes-rtx-f89d/lab-systems-fix/hostman-console-systems-fix.sh | bash")
    # Exit non-zero if actionable
    return 1 if report["actions"] else 0


if __name__ == "__main__":
    raise SystemExit(main())

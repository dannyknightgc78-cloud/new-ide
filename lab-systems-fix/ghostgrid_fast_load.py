"""Fast GhostGrid load aggregator for lab /api/ops/ghostgrid/load.

Mirrors the SPA contract in Ops Command (GhostGrid Adversarial Load panel).
Uses only fast public endpoints on https://ghostgrid.dannygc.cloud and skips
broken /api/ghostgrid/adversarial/* routes that currently 500.
"""

from __future__ import annotations

import asyncio
import os
import time
from typing import Any

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None  # type: ignore

DEFAULT_BASE = os.environ.get("GHOSTGRID_PUBLIC_URL", "https://ghostgrid.dannygc.cloud").rstrip("/")
DEFAULT_TIMEOUT = float(os.environ.get("GHOSTGRID_PROBE_TIMEOUT_SEC", "2.5"))


def _offline(detail: str = "GhostGrid unreachable", public_url: str = DEFAULT_BASE) -> dict[str, Any]:
    return {
        "ok": False,
        "online": False,
        "honeypot": {
            "online": False,
            "attack_events": 0,
            "mirror_events": 0,
            "tactics_tracked": 0,
            "top_tactic": None,
            "latency_ms": 0,
            "detail": "unreachable",
        },
        "abx": {
            "online": False,
            "witness_events": 0,
            "drift_alerts": 0,
            "agents_tracked": 0,
            "verify_status": None,
            "entries_sealed": 0,
            "head_hash": "",
            "latency_ms": 0,
            "detail": "unreachable",
        },
        "adversarial_events": 0,
        "drift_alerts": 0,
        "tamper": False,
        "public_url": public_url,
        "abx_url": f"{public_url}/abx",
        "detail": detail,
        "incident": {"ok": True, "action": "none", "reasons": []},
    }


async def _get_json(client: "httpx.AsyncClient", path: str) -> tuple[dict[str, Any] | None, int, str | None]:
    t0 = time.perf_counter()
    try:
        r = await client.get(path)
        ms = int((time.perf_counter() - t0) * 1000)
        if r.status_code >= 400:
            return None, ms, f"HTTP {r.status_code}"
        data = r.json()
        if not isinstance(data, dict):
            return None, ms, "non-object JSON"
        return data, ms, None
    except Exception as exc:  # noqa: BLE001
        ms = int((time.perf_counter() - t0) * 1000)
        return None, ms, str(exc)[:160]


def _top_tactic(by_tactic: dict[str, Any] | None) -> tuple[str | None, int]:
    if not by_tactic:
        return None, 0
    ranked = sorted(
        ((str(k), int(v) if isinstance(v, (int, float)) else 0) for k, v in by_tactic.items()),
        key=lambda kv: kv[1],
        reverse=True,
    )
    if not ranked:
        return None, 0
    return ranked[0][0], len(ranked)


async def build_ghostgrid_load(
    base_url: str = DEFAULT_BASE,
    timeout_sec: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """Aggregate honeypot + ABX status in parallel with short timeouts."""
    base = base_url.rstrip("/")
    if httpx is None:
        return _offline("httpx not installed", base)

    timeout = httpx.Timeout(timeout_sec, connect=min(1.5, timeout_sec))
    async with httpx.AsyncClient(base_url=base, timeout=timeout, follow_redirects=True) as client:
        health_t, stats_t, abx_health_t, abx_stats_t, abx_verify_t = await asyncio.gather(
            _get_json(client, "/api/health"),
            _get_json(client, "/api/ghostgrid/stats"),
            _get_json(client, "/api/abx/health"),
            _get_json(client, "/api/abx/stats"),
            _get_json(client, "/api/abx/verify"),
        )

    health, health_ms, health_err = health_t
    stats, stats_ms, _ = stats_t
    abx_health, abx_health_ms, abx_health_err = abx_health_t
    abx_stats, abx_stats_ms, _ = abx_stats_t
    abx_verify, abx_verify_ms, _ = abx_verify_t

    def _is_decoy(payload: dict[str, Any] | None) -> bool:
        # Mirror-mode honeytokens look real but carry the decoy provider stamp.
        return bool(payload and payload.get("service") == "NimbusCloud AI")

    if _is_decoy(health):
        health = None
    if _is_decoy(stats):
        stats = None
    if _is_decoy(abx_health):
        abx_health = None
    if _is_decoy(abx_stats):
        abx_stats = None
    if _is_decoy(abx_verify):
        abx_verify = None

    honeypot_online = bool(health and health.get("ok") and health.get("service") == "ghostgrid")

    st = (stats or {}).get("stats") if isinstance((stats or {}).get("stats"), dict) else {}
    attack_events = int(st.get("totalEvents") or 0)
    mirror_events = int(st.get("mirrorEvents") or 0)
    top_tactic, tactics_tracked = _top_tactic(st.get("byTactic") if isinstance(st.get("byTactic"), dict) else {})

    abx_online = bool(
        (abx_health and abx_health.get("ok") and abx_health.get("service") == "ghostgrid-abx")
        or (abx_verify and abx_verify.get("ok") and abx_verify.get("status"))
        or (abx_stats and abx_stats.get("ok") and isinstance(abx_stats.get("stats"), dict))
    )

    ast = (abx_stats or {}).get("stats") if isinstance((abx_stats or {}).get("stats"), dict) else {}
    witness_events = int(ast.get("total") or 0)
    drift_alerts = int(ast.get("drift_alerts") or 0)
    agents = ast.get("agents") if isinstance(ast.get("agents"), dict) else {}
    agents_tracked = len(agents)

    verify_status = None
    entries_sealed = 0
    head_hash = ""
    tamper = False
    if abx_verify and abx_verify.get("ok"):
        verify_status = str(abx_verify.get("status") or "PASS")
        entries_sealed = int(abx_verify.get("entries_total") or abx_verify.get("checked") or 0)
        head_hash = str(abx_verify.get("head_hash") or "")[:12]
        tamper = verify_status.upper() in {"TAMPER_DETECTED", "FAIL", "FAILED"}
    elif abx_stats and abx_stats.get("ok"):
        head_hash = str(ast.get("head_hash") or "")[:12]
        entries_sealed = witness_events

    hop_ms = max(health_ms, stats_ms)
    abx_ms = max(abx_health_ms, abx_stats_ms, abx_verify_ms)
    online = honeypot_online or abx_online

    if not online:
        detail = health_err or abx_health_err or "GhostGrid unreachable"
        out = _offline(detail, base)
        out["honeypot"]["latency_ms"] = hop_ms
        out["abx"]["latency_ms"] = abx_ms
        return out

    return {
        "ok": True,
        "online": True,
        "honeypot": {
            "online": honeypot_online,
            "attack_events": attack_events,
            "mirror_events": mirror_events,
            "tactics_tracked": tactics_tracked,
            "top_tactic": top_tactic,
            "latency_ms": hop_ms,
            "detail": "honeypot online" if honeypot_online else (health_err or "honeypot offline"),
        },
        "abx": {
            "online": abx_online,
            "witness_events": witness_events,
            "drift_alerts": drift_alerts,
            "agents_tracked": agents_tracked,
            "verify_status": verify_status,
            "entries_sealed": entries_sealed,
            "head_hash": head_hash,
            "latency_ms": abx_ms,
            "detail": "abx online" if abx_online else (abx_health_err or "abx offline"),
        },
        "adversarial_events": attack_events,
        "drift_alerts": drift_alerts,
        "tamper": tamper,
        "public_url": base,
        "abx_url": f"{base}/abx",
        "detail": "online",
        "incident": {"ok": True, "action": "none", "reasons": []},
    }


def build_ghostgrid_load_sync(
    base_url: str = DEFAULT_BASE,
    timeout_sec: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    return asyncio.run(build_ghostgrid_load(base_url=base_url, timeout_sec=timeout_sec))


if __name__ == "__main__":
    import json
    import sys

    t0 = time.perf_counter()
    payload = build_ghostgrid_load_sync()
    elapsed = time.perf_counter() - t0
    print(json.dumps(payload, indent=2))
    print(f"\n# elapsed_sec={elapsed:.3f} online={payload.get('online')}", file=sys.stderr)
    sys.exit(0 if payload.get("online") else 1)

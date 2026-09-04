"""Unit tests for GhostGrid fast load + dual GPU helpers."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import dual_gpu_status as dgs  # noqa: E402
import ghostgrid_fast_load as gfl  # noqa: E402


class FakeResp:
    def __init__(self, status_code: int, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class GhostGridFastLoadTests(unittest.IsolatedAsyncioTestCase):
    async def test_online_payload_shape(self):
        async def fake_get(path: str):
            mapping = {
                "/api/health": FakeResp(200, {"ok": True, "service": "ghostgrid"}),
                "/api/ghostgrid/stats": FakeResp(
                    200,
                    {
                        "ok": True,
                        "stats": {
                            "totalEvents": 3,
                            "mirrorEvents": 1,
                            "byTactic": {"recon": 2, "exfil": 1},
                        },
                    },
                ),
                "/api/abx/health": FakeResp(200, {"ok": True, "service": "ghostgrid-abx"}),
                "/api/abx/stats": FakeResp(
                    200, {"ok": True, "stats": {"total": 4, "agents": {"a": 1}, "drift_alerts": 0, "head_hash": "abc"}}
                ),
                "/api/abx/verify": FakeResp(
                    200,
                    {
                        "ok": True,
                        "status": "PASS",
                        "entries_total": 4,
                        "head_hash": "abcdef0123456789",
                    },
                ),
            }
            return mapping[path]

        client = MagicMock()
        client.get = AsyncMock(side_effect=fake_get)
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=None)

        with patch.object(gfl, "httpx") as hx:
            hx.Timeout = MagicMock()
            hx.AsyncClient = MagicMock(return_value=client)
            out = await gfl.build_ghostgrid_load()

        self.assertTrue(out["ok"])
        self.assertTrue(out["online"])
        self.assertTrue(out["honeypot"]["online"])
        self.assertEqual(out["honeypot"]["attack_events"], 3)
        self.assertEqual(out["honeypot"]["top_tactic"], "recon")
        self.assertEqual(out["honeypot"]["tactics_tracked"], 2)
        self.assertTrue(out["abx"]["online"])
        self.assertEqual(out["abx"]["verify_status"], "PASS")
        self.assertEqual(out["abx"]["head_hash"], "abcdef012345")
        self.assertEqual(out["public_url"], "https://ghostgrid.dannygc.cloud")

    async def test_rejects_decoy_nimbus_payload(self):
        async def fake_get(path: str):
            return FakeResp(200, {"ok": True, "service": "NimbusCloud AI", "path": path, "data": []})

        client = MagicMock()
        client.get = AsyncMock(side_effect=fake_get)
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=None)
        with patch.object(gfl, "httpx") as hx:
            hx.Timeout = MagicMock()
            hx.AsyncClient = MagicMock(return_value=client)
            out = await gfl.build_ghostgrid_load()
        self.assertFalse(out["online"])
        self.assertFalse(out["honeypot"]["online"])


class DualGpuTests(unittest.TestCase):
    def test_ensure_dual_panels_fills_empty(self):
        with patch.object(dgs, "probe_nvidia_smi", return_value=[]), patch.object(
            dgs,
            "probe_remote_ollama",
            return_value=[
                dgs._panel(index=0, name="RTX A"),
                dgs._panel(index=1, name="RTX B"),
            ],
        ):
            out = dgs.ensure_dual_panels({"ok": False, "gpu": {"panels": []}})
        self.assertTrue(out["ok"])
        self.assertEqual(len(out["gpu"]["panels"]), 2)
        self.assertTrue(out.get("dual_gpu"))

    def test_build_from_smi(self):
        smi = "0, NVIDIA RTX PRO 6000, 10, 1024, 8192\n1, NVIDIA RTX PRO 6000, 20, 2048, 8192\n"
        with patch("subprocess.check_output", return_value=smi):
            panels = dgs.probe_nvidia_smi()
        self.assertEqual(len(panels), 2)
        self.assertEqual(panels[0]["index"], 0)
        self.assertEqual(panels[1]["index"], 1)
        self.assertAlmostEqual(panels[0]["vram_pct"], 12.5)


if __name__ == "__main__":
    unittest.main()

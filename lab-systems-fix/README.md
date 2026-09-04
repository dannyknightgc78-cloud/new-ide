# Lab Systems Fix — Nimbus Urge · Aegis · GhostGrid · Dual RTX

Drop-in recovery for [lab.dannygc.cloud/systems](https://lab.dannygc.cloud/systems) and [nimbus.dannygc.cloud/urge](https://nimbus.dannygc.cloud/urge) when Aegis is down, GhostGrid shows **OFFLINE**, probes stall, and dual RTX panels never appear.

## Live diagnosis (Nimbus Urge)

| Check | Result |
|-------|--------|
| Nimbus `/api/status` health_score | **~50%** (many `cloudsit.app` public DOWNs) |
| Nimbus `infra.watchdog` | **down** |
| Nimbus server `rtx-pro` | **OK** — label `RTX Pro 6000 x2` |
| `ghostgrid.dannygc.cloud/api/health` | **OK** (~200ms) |
| `lab …/api/ops/ghostgrid/load` | **~48s** (SPA 15s timeout → OFFLINE) |
| `lab …/api/ops/services/dashboard` | probe timeout → no GPU panels |
| `lab …/protect/api/health` (Aegis Station) | **502** (nginx proxy) |
| `protect.dannygc.cloud` | **up** (API auth-gated) |
| GhostGrid `/adversarial/pulse` | **500** |

Root cause: GhostGrid + RTX peer are healthy. Lab’s slow GhostGrid aggregator, broken `/protect/` proxy (Aegis), and down watchdog make `/systems` look offline. Dual RTX is confirmed by Nimbus (`rtx-pro`) but dashboard probes never finish.

## Apply on Hostman (cloudit1 / fra-1-vm-fpgk)

Paste into the Hostman web console as root:

```bash
curl -fsSL https://raw.githubusercontent.com/dannyknightgc78-cloud/new-ide/cursor/ghostgrid-probes-rtx-f89d/lab-systems-fix/hostman-console-systems-fix.sh | bash
```

Or clone this branch onto the box and run:

```bash
cd /root/lab-dannygc   # or wherever carl-ops lives
bash /path/to/lab-systems-fix/hostman-console-systems-fix.sh
```

## What the scripts do

1. **`nimbus_urge_check.py`** — pulls Nimbus Urge `/api/status` + live path probes; prints actionable fix list (watchdog, Aegis 502, GhostGrid load, dual GPU, cloudsit tunnel).
2. **`ghostgrid_fast_load.py`** — builds the exact JSON shape `/api/ops/ghostgrid/load` must return, using only fast public GhostGrid endpoints. Skips broken `/adversarial/*`. Target: **&lt;2s**.
3. **`dual_gpu_status.py`** — emits `gpu.panels[]` for dual RTX (`#0`/`#1`) from `nvidia-smi` or `ai.dannygc.cloud`.
4. **`patch_carl_ops.py`** — hot-patches carl-ops under `/root/lab-dannygc`.
5. **`hostman-console-systems-fix.sh`** — Nimbus Urge recovery: restart watchdog + Aegis/protect, fix nginx `/protect/api` proxy, patch GhostGrid/GPU, soft-restart cloudflared for cloudsit DOWNs.
6. **`diagnose.sh`** — external health probe (run from anywhere).

## Verify

```bash
bash lab-systems-fix/diagnose.sh
# GhostGrid load should be < 3s and online:true
curl -sS -m 5 https://lab.dannygc.cloud/api/ops/ghostgrid/load | jq '{online,detail,honeypot:.honeypot.online,abx:.abx.online}'
curl -sS -m 15 https://lab.dannygc.cloud/api/ops/services/dashboard | jq '.gpu.panels // .gpu'
curl -sS -m 5 https://lab.dannygc.cloud/protect/api/health
```

Refresh `/systems` — GhostGrid pill should read **live**, probe tiles should populate, and Aegis + dual RTX panels should show `#0` / `#1`.

## Need SSH for Cursor agents?

On the Hostman console, authorize the Cursor agent key (already included in the console script), then agents can re-run patches without pasting.

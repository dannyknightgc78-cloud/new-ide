# Lab Systems Fix — GhostGrid · Probes · Dual RTX

Drop-in recovery for [lab.dannygc.cloud/systems](https://lab.dannygc.cloud/systems) when GhostGrid shows **OFFLINE**, probes stall, and dual RTX panels never appear.

## Live diagnosis (2026-09-04)

| Check | Result |
|-------|--------|
| `https://ghostgrid.dannygc.cloud/api/health` | **OK** (~200ms) |
| `https://ghostgrid.dannygc.cloud/api/abx/verify` | **PASS** |
| `https://ghostgrid.dannygc.cloud/api/ghostgrid/adversarial/pulse` | **500** (probes broken) |
| `lab …/api/ops/ghostgrid/load` | **OK but ~48s** (UI aborts at 15s → OFFLINE) |
| `lab …/api/ops/services/dashboard` | **probe timeout** → all GPUs `available:false` |
| `lab …/api/ops/servers/local` | `gpu: null`, `gpus: []` (lab VM has no NVIDIA) |
| `lab …/protect/api/health` (Aegis) | **502** |

Root cause: GhostGrid itself is up. Lab’s ops aggregator probes too slowly (and hits broken `/adversarial/*` paths). The SPA treats that as offline. Dual RTX lives on the cloudit-gpu peer; dashboard probes never finish, so panels stay empty.

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

1. **`ghostgrid_fast_load.py`** — builds the exact JSON shape `/api/ops/ghostgrid/load` must return, using only fast public GhostGrid endpoints (`/api/health`, `/api/ghostgrid/stats`, `/api/abx/*`). Skips the broken `/adversarial/*` routes. Target: **&lt;2s**.
2. **`dual_gpu_status.py`** — emits `gpu.panels[]` for dual RTX (index 0 + 1) from `nvidia-smi` or a remote probe URL. Lab UI already prefers `gpu.panels` over the single `blackwell` stub.
3. **`patch_carl_ops.py`** — hot-patches a running carl-ops / FastAPI tree under `/root/lab-dannygc` to wire the fast loader + dual GPU panels + shorter probe timeouts.
4. **`hostman-console-systems-fix.sh`** — restarts GhostGrid/ABX, Aegis (`protect`), systems-agent, applies the patch, verifies latency.
5. **`diagnose.sh`** — external health probe (run from anywhere).

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

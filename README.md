# new-ide

Cloud agent workspace for DannyGC projects.

## Lab systems fix (GhostGrid · probes · dual RTX)

See [`lab-systems-fix/README.md`](lab-systems-fix/README.md).

GhostGrid at https://ghostgrid.dannygc.cloud is healthy; lab `/systems` shows it OFFLINE because `/api/ops/ghostgrid/load` takes ~48s (UI timeout 15s). Dual RTX panels are empty because dashboard probes time out. Aegis `/protect/api` returns 502.

**Apply on Hostman:**

```bash
curl -fsSL https://raw.githubusercontent.com/dannyknightgc78-cloud/new-ide/cursor/ghostgrid-probes-rtx-f89d/lab-systems-fix/hostman-console-systems-fix.sh | bash
```

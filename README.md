# new-ide

Cloud agent workspace for DannyGC projects.

## Lab systems fix (Nimbus Urge · Aegis · GhostGrid · dual RTX)

See [`lab-systems-fix/README.md`](lab-systems-fix/README.md).

Nimbus Urge (`https://nimbus.dannygc.cloud/urge`) shows fleet health ~50%, **watchdog down**, while **RTX Pro 6000 x2** is OK. Lab `/systems` Aegis is **502** (`/protect/api`), GhostGrid load is too slow for the UI, dual RTX panels empty.

**Apply on Hostman:**

```bash
curl -fsSL https://raw.githubusercontent.com/dannyknightgc78-cloud/new-ide/cursor/ghostgrid-probes-rtx-f89d/lab-systems-fix/hostman-console-systems-fix.sh | bash
```

**Check from anywhere:**

```bash
python3 lab-systems-fix/nimbus_urge_check.py
```

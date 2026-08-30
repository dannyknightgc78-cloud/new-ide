# Queendar + Sticky (separate products)

| Product | URL | This repo |
|---------|-----|-----------|
| **Queendar** | https://queendar.com | `queendar/` — full safety app + API |
| **Sticky** | https://getsticky.men | `sticky-fix/` — circular QR for Sticky only |

## Queendar

Complete source recovered from live Hostman (`/opt/queendar/app` + `owner-auth.py`).

```bash
cd queendar
npm install
npm run dev:api   # terminal 1 — API :3019
npm run dev       # terminal 2 — opens browser
```

Deploy from Mac: `bash queendar/scripts/deploy-hostman-safety.sh hostman`

See `queendar/README.md`.

## Sticky

True concentric-ring QR (not square + rounded corners):

```bash
cd sticky-fix
npm install
npm run generate:preview
# Deploy on Mac: bash sticky-fix/deploy-to-mac.sh
```

## Other folders

- `queendar-portal/` — old performer hub (not live; backup on Hostman `/opt/queendar-portal`)
- `queendar-src-may.zip` — early Bolt starter only; prefer `queendar/` tree above

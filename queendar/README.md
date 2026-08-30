# Queendar

**Live:** https://queendar.com  
**Not Sticky.** Sticky is a separate product at https://getsticky.men.

LGBTQ+ travel safety companion: Vibe Radar, AI venue Scan, Crown Log, SOS / ICE card, Safe Havens.

## What's in this folder

| Path | What it is |
|------|------------|
| `src/` | Full frontend (matches production — SOS, GPS, havens, Plus) |
| `public/` | PWA icon + manifest |
| `api/owner-auth.py` | Production API (`queendar-api` on Hostman `:3019`) |
| `deploy/` | Docker SPA package + `nginx/queendar.com.conf` |
| `scripts/deploy-hostman-safety.sh` | Deploy SPA + API to Hostman |

The May zip (`queendar-src-may.zip`) was the early Bolt starter only. **This tree is the complete app.**

## Run locally (no extra setup)

```bash
cd queendar
cp .env.example .env          # optional — API uses its own env
npm install
npm run dev:api               # API → http://127.0.0.1:3019
npm run dev                   # opens browser → http://localhost:5173
```

`vite` proxies `/api` to the local API. Preview after build:

```bash
npm run build && npm run preview
```

## Deploy (Mac with `hostman` SSH)

```bash
bash scripts/deploy-hostman-safety.sh hostman
```

Production layout on Hostman:

- SPA → Docker `queendar-safety` on `127.0.0.1:3011`
- API → `python3 /opt/queendar/owner-auth.py` on `127.0.0.1:3019`
- Nginx `queendar.com` → `/` → `:3011`, `/api/` → `:3019`

## Guest vs signed-in

- **Guest** — Explore radar/scan; ICE card stored on device only; Crown Log / SOS server features need an account.
- **Signed in** — Encrypted journal, profile, watch timer, SOS to contacts (when Twilio is configured).

## Notes

- Branding: gold crown + radar mark, Cormorant/Manrope, OG image at `/og.png`
- Performer portal code lives in `../queendar-portal` (backup only — not live on queendar.com).
- Trooper / Vultr scripts under `scripts/` are retired; use Hostman deploy.

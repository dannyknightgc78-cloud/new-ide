# Queendar Portal (archive / backup)

Sovereign performer hub — Phase 1 scaffold.

**Not live on queendar.com.** Production `https://queendar.com` runs the **safety app** (radar / scan / SOS). This portal remains as a Hostman backup at `/opt/queendar-portal`.

Handoff notes below are historical. For the live safety product see `../queendar/README.md`.

## What ships in Phase 1

- Public performer profiles at `/p/:slug`
- Mystery Match discovery (pick aesthetics → weighted reveal)
- Booking inquiry form → JSON store + optional Telegram DM
- Admin-gated performer creation (`ADMIN_API_KEY`)
- File-backed data in Docker volume `/data`

## Local dev (Mac)

```bash
cd ~/projects/queendar-portal
cp .env.example .env
# Set ADMIN_API_KEY to any secret string
npm install
npm start
# → http://localhost:3011
```

## Seed demo performers

```bash
# With server running locally:
bash scripts/seed-demo.sh
```

Or manually:

```bash
curl -X POST http://localhost:3011/api/performers \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -d '{
    "stageName": "Velvet Nocturne",
    "pronouns": "she/they",
    "city": "San Francisco",
    "bio": "Gothic horror queen.",
    "aestheticTags": ["gothic", "horror"]
  }'
```

## Deploy (Hostman)

```bash
./deploy.sh hostman --repair
# or: rsync to hostman:/opt/queendar-portal && docker compose up -d --build
```

On Hostman `/opt/queendar-portal/.env`: `PUBLIC_URL`, `ADMIN_API_KEY`, `AI_BASE_URL=http://host.docker.internal:18001/v1`, `AI_MODEL=Qwen3-Coder-Next-FP8`.

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | Status (AI + admin + ops) |
| GET | `/api/aesthetics` | — | Aesthetic tag list |
| GET | `/api/performers` | — | Public roster |
| GET | `/api/performers/:slug` | — | Profile |
| POST | `/api/performers` | `x-admin-key` | Create performer |
| POST | `/api/match` | — | Mystery match `{ tags: [] }` |
| POST | `/api/match/vibe` | — | AI vibe → tags → matches |
| POST | `/api/bookings` | — | Booking inquiry |
| GET | `/api/ops/tunnels` | `x-admin-key` | CF + GPU tunnel status |
| POST | `/api/ops/tunnels/heal` | `x-admin-key` | Restart Hostman tunnels |

## Next phases

- **Phase 2:** Booking agent (LM Studio email triage, calendar holds)
- **Phase 3:** Encrypted vault (MinIO) + venue agency dashboard
- **Monetization:** Sovereignty fee billing, Stripe Connect tips

## Tests

```bash
npm test
```

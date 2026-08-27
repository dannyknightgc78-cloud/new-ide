# Queendar (recovered)

LGBTQ+ **travel safety / nightlife companion** app recovered from the Mac.

## Source of truth

| Path | What it is |
|------|------------|
| `queendar/` | Full Vite + React + Supabase app (Vibe Radar, AI Scan, Crown Log) |
| `queendar-src-may.zip` | Same source as a zip |
| `queendar-portal/` | Different product (performer hub) — not this app |

### Where it lived on the Mac

- **App:** `/Users/danielknight/queendar`
- **May 27 archive zip:** `~/Desktop/Decluttered/Archives/queendar.zip` (Cursor session metadata only — not the app)
- **May 27 folder:** `~/Desktop/FINAL_SAFE_COPY_MAY27` (server dump; `queendar-agent-workspace` empty)

Originally unpacked from Bolt: `project-bolt-sb1-g1amqsru.zip` (no longer in Downloads).

## Run locally

```bash
cd queendar
cp .env.example .env   # add Supabase URL + anon key
npm install
npm run dev
```

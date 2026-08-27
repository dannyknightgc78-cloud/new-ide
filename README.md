# Queendar (recovered)

LGBTQ+ **travel safety / nightlife companion** app recovered from the Mac.

**Images / branding assets:** not added yet — waiting on Queendar art.

**Round QR / “Sticky”:** that product is **STICKY** (`getsticky.men`), not Queendar. Live round QR already exists at:

- https://getsticky.men/qr  
- https://getsticky.men/api/qr  
- Source: `lab-dannygc/sites/coolvibes/web/lib/circularQr.ts`

## Source of truth

| Path | What it is |
|------|------------|
| `queendar/` | Vite + React + Supabase safety app (Vibe Radar, AI Scan, Crown Log) |
| `queendar-src-may.zip` | Same source as a zip |
| `queendar-portal/` | Different product (performer hub) — not this app |

### Where it lived on the Mac

- **App:** `/Users/danielknight/queendar`
- **May 27 archive zip:** `~/Desktop/Decluttered/Archives/queendar.zip` (Cursor session metadata only)
- **May 27 folder:** `~/Desktop/FINAL_SAFE_COPY_MAY27` (server dump; empty workspace)

## Run locally

```bash
cd queendar
cp .env.example .env   # add Supabase URL + anon key
npm install
npm run dev
```

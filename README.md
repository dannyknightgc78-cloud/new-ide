# Queendar (safety app)

Live at **https://queendar.com** — LGBTQ+ travel safety / nightlife companion (Vibe Radar, AI Scan, Crown Log).

Performer-hub portal was replaced on Hostman `:3011`; backup remains at `/opt/queendar-portal`.

## Deploy (from zip)

Canonical app zip: `queendar-src-may.zip` (also on Mac as `~/projects/ghost-home/uploads/queendar.zip`).

Note: Desktop `Archives/queendar.zip` is Cursor session metadata only — not the app.

```bash
# needs .env with VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
bash queendar/scripts/deploy-from-zip.sh queendar-src-may.zip
# or from Mac folder:
# bash scripts/deploy-hostman-safety.sh hostman
```

## Local

```bash
cd queendar
cp .env.example .env
npm install
npm run dev
```

## Notes

- Round QR / Sticky is a separate product (`getsticky.men`)
- Queendar branding images not added yet
- Source recovered from Mac `~/queendar`

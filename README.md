# Queendar (safety app)

Live at **https://queendar.com** — LGBTQ+ travel safety / nightlife companion (Vibe Radar, AI Scan, Crown Log).

Performer-hub portal was replaced on Hostman `:3011`; backup remains at `/opt/queendar-portal`.

## Deploy

```bash
cd queendar
# needs .env with VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
bash scripts/deploy-hostman-safety.sh hostman
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

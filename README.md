# Queendar

Recovered from Mac `~/projects/queendar-portal` (via Ghost Home → Genie R2).

## Findings

| Location | Result |
|----------|--------|
| GitHub `dannyknightgc78-cloud` | No Queendar repo |
| Desktop `Decluttered/Archives/queendar.zip` | Exists but **empty** (8.3KB) |
| Mac `~/projects/queendar-portal` | **Real source** (live product) |
| Mac `FINAL_SAFE_COPY_MAY27/queendar-agent-workspace` | Empty folder |
| R2 `danny-backups` | Lab tarballs + now `queendar/queendar-portal-src.zip` |
| Hostman `/opt/queendar-portal` | Production deploy (cloudit1) |

## What the project is today

**Sovereign performer hub** (Phase 1) — roster, Mystery Match, bookings — live at https://queendar.com.

Not currently a personal-safety / SOS app. Phase 3 mentions an encrypted vault.

## Run locally

```bash
cd queendar-portal
cp .env.example .env
npm install
npm start
# http://localhost:3011
```

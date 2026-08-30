# Queen handoff — queendar-portal (archive)

> **Status:** Portal is **not** the live queendar.com product. Live site = safety app + `owner-auth.py` API.  
> Portal backup: Hostman `/opt/queendar-portal`. Full safety source: `../queendar/`.

Continue from this archived state. **Do not restart from scratch.** Do not paste Cursor transcripts.

## Live (safety app — current)

| Item | Value |
|------|--------|
| Public | https://queendar.com |
| SPA | Hostman `/opt/queendar` Docker `:3011` |
| API | `owner-auth.py` `:3019` (`queendar-api`) |
| Sticky (separate) | https://getsticky.men |

## Portal (this folder — backup)

| Item | Value |
|------|--------|
| Host backup | Hostman `cloudit1` `/opt/queendar-portal` |
| AI | cloudit-gpu coder via `:18001` → `nemotron-3.5-lightning:latest` |

## What Queen owned (portal era)

- Product portal (roster, vibe match, bookings)
- Admin performer create (`x-admin-key`)
- Tunnel heal/status via Queen ops API (shared `QUEEN_OPS_TOKEN`)

## Verify (live safety API)

```bash
curl -sS https://queendar.com/api/health | jq .
curl -sS https://queendar.com/api/radar | jq .ok
curl -sS https://queendar.com/api/emergency | jq .
```

## Deploy safety app

```bash
bash ../queendar/scripts/deploy-hostman-safety.sh hostman
```

## Rules

1. New chat only — `@` this file first.
2. No secrets in chat.
3. Prefer Hostman `/opt/queendar` for the live safety app.
4. Inference = cloudit-gpu only (Trooper retired).
5. Sticky QR changes go to getsticky.men only — never Queendar.

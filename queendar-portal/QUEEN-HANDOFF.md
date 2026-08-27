# Queen handoff — queendar-portal

Continue from this live state. **Do not restart from scratch.** Do not paste Cursor transcripts.

## Live

| Item | Value |
|------|--------|
| Public | https://queendar.com |
| Redirect | https://queendar.cloudsit.app and https://queendar.dannygc.cloud → queendar.com |
| Host | Hostman `cloudit1` `/opt/queendar-portal` (:3011) |
| AI | cloudit-gpu coder via `:18001` → `nemotron-3.5-lightning:latest` |
| Ops | `POST /api/ops/tunnels/heal` (admin) → Hostman ops-agent |

## What Queen owns

- Product portal (roster, vibe match, bookings)
- Admin performer create (`x-admin-key`)
- Tunnel heal/status via Queen ops API (shared `QUEEN_OPS_TOKEN`)

## What Queen does **not** own yet (Nimbus / Cursor)

- Full fleet heal, DNS, CF ingress edits, GPU vLLM process start
- Telegram `/fix` / `/emergency` empire recovery

## Verify

```bash
curl -sS https://queendar.com/api/health | jq .
curl -sS -X POST https://queendar.com/api/match/vibe \
  -H 'Content-Type: application/json' \
  -d '{"vibe":"gothic glam","count":2}' | jq .
# Admin (key from Hostman .env):
curl -sS -H "x-admin-key: $ADMIN_API_KEY" \
  https://queendar.com/api/ops/tunnels | jq .
curl -sS -X POST -H "x-admin-key: $ADMIN_API_KEY" \
  https://queendar.com/api/ops/tunnels/heal | jq .
```

## Deploy

```bash
./deploy.sh hostman --repair
```

## Rules

1. New chat only — `@` this file first.
2. No secrets in chat.
3. Prefer Hostman `/opt/queendar-portal`; never compose on Mac for prod.
4. Inference = cloudit-gpu only (Trooper retired).

## IntelliJ

Open `queendar-portal` in IntelliJ → new AI chat → attach `INTELLIJ-HANDOFF.md` + this file.  
Master: `/Users/danielknight/projects/INTELLIJ-HANDOFF.md`

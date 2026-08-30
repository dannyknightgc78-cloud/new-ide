# IntelliJ handoff — queendar-portal

**NEW AI chat only.** Never paste Cursor transcripts.

Attach first: this file + `QUEEN-HANDOFF.md`  
Master map: `/Users/danielknight/projects/INTELLIJ-HANDOFF.md`

## Live

- https://queendar.com — Hostman `/opt/queendar-portal` (:3011)
- AI: cloudit-gpu `nemotron-3.5-lightning:latest` via `host.docker.internal:18001`
- Tunnel heal: `POST /api/ops/tunnels/heal` (admin) → ops-agent
- Keys: Hostman `/root/.queendar-admin.env` only — never paste into chat

## Deploy

```bash
./deploy.sh hostman --repair
```

## Rules

1. Do not restart from scratch.
2. No secrets/keys in chat.
3. Never docker compose on Mac for prod.
4. Inference = cloudit-gpu only (Trooper retired).

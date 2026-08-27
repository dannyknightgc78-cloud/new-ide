#!/usr/bin/env bash
# First-time Queendar deploy: build → Trooper :8802 → Cloudflare tunnel + DNS.
#
# Usage:
#   npm run first:deploy
#   CLOUDFLARE_API_TOKEN=... npm run first:deploy
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Queendar first deploy (Trooper AI) ==="

if [ ! -f .env ]; then
  echo "✗ Missing .env — copy .env.example and set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY"
  exit 1
fi

if ! grep -q '^VITE_SUPABASE_URL=' .env || ! grep -q '^VITE_SUPABASE_ANON_KEY=' .env; then
  echo "✗ .env must include VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
  exit 1
fi

echo "→ npm install"
npm install

echo "→ Supabase schema (run once in dashboard if not done)"
echo "  supabase/migrations/20260518083434_queendar_initial_schema.sql"

echo "→ deploy app to Trooper :8802"
bash "$ROOT/scripts/deploy-trooper.sh"

echo "→ install keepalive cron on Trooper"
bash "$ROOT/scripts/install-queendar-cron.sh" --remote

echo "→ Cloudflare tunnel + DNS (required for public URL)"
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  bash "$ROOT/scripts/apply-queendar-ingress.sh" || true
  echo ""
  echo "=== App deployed on Trooper — public URL needs CLOUDFLARE_API_TOKEN ==="
  echo "  export CLOUDFLARE_API_TOKEN=your_token"
  echo "  bash scripts/apply-queendar-ingress.sh"
  exit 0
fi

bash "$ROOT/scripts/apply-queendar-ingress.sh"

echo ""
echo "=== First deploy complete ==="
echo "  https://queendar.dannygc.cloud/"
echo "  Trooper: http://127.0.0.1:${QUEENDAR_PORT:-8802}/"

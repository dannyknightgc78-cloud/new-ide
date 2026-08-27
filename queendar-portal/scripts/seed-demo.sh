#!/bin/bash
# Seed sample performers for local dev / demo. Requires ADMIN_API_KEY in .env.
set -e
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Copy .env.example to .env and set ADMIN_API_KEY"
  exit 1
fi

# shellcheck disable=SC1091
source .env
BASE="${SEED_BASE:-http://127.0.0.1:3011}"
KEY="${ADMIN_API_KEY:?Set ADMIN_API_KEY in .env}"

seed() {
  local name="$1"
  shift
  curl -sf -X POST "$BASE/api/performers" \
    -H "Content-Type: application/json" \
    -H "x-admin-key: $KEY" \
    -d "$1" > /dev/null
  echo "  + $name"
}

echo "Seeding performers at $BASE …"
seed "Velvet Nocturne" '{"stageName":"Velvet Nocturne","pronouns":"she/they","city":"San Francisco","bio":"Gothic horror queen with a taste for melodrama and blood-red lips.","aestheticTags":["gothic","horror"],"tipUrl":"https://stripe.com"}'
seed "Dusty Rhinestone" '{"stageName":"Dusty Rhinestone","pronouns":"she/her","city":"Portland","bio":"Camp comedy icon — louder than the spotlight and twice as shiny.","aestheticTags":["camp","comedy"]}'
seed "Sable Couture" '{"stageName":"Sable Couture","pronouns":"she/her","city":"New York","bio":"Runway-ready pageant polish with high-fashion eleganza.","aestheticTags":["high-fashion","pageant"]}'
echo "Done."

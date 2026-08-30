#!/usr/bin/env bash
# Prefer the full tree deploy. The May zip was the Bolt starter only.
# Usage: bash scripts/deploy-from-zip.sh [optional-zip]
# If no zip given, deploys the current queendar/ folder.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZIP="${1:-}"

if [ -n "$ZIP" ]; then
  echo "⚠ Zip deploy is for emergencies only. Full app lives in queendar/ (not May starter)."
  echo "  Prefer: bash scripts/deploy-hostman-safety.sh hostman"
fi

exec bash "$ROOT/scripts/deploy-hostman-safety.sh" "${QUEENDAR_DEPLOY_HOST:-hostman}"

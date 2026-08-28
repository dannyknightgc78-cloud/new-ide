#!/usr/bin/env bash
# Copy ring QR into lab-dannygc coolvibes and redeploy Sticky (run ON Mac)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET="${STICKY_WEB:-$HOME/projects/lab-dannygc/sites/coolvibes/web}"
cp "$ROOT/circularQr.ts" "$TARGET/lib/circularQr.ts"
cd "$HOME/projects/lab-dannygc"
bash scripts/deploy-sticky.sh
echo "✓ Sticky redeployed with concentric-ring QR"

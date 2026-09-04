#!/usr/bin/env bash
# External diagnosis for GhostGrid / probes / dual RTX / Aegis (no SSH required).
set -uo pipefail

TIMEOUT="${TIMEOUT:-12}"
FAIL=0

check() {
  local name="$1" url="$2" max="${3:-$TIMEOUT}"
  local code t
  t=$(curl -sS -o /tmp/diag_body -w '%{http_code} %{time_total}' --connect-timeout 5 --max-time "$max" "$url" 2>/dev/null || echo "000 0")
  code=${t%% *}
  local elapsed=${t##* }
  case "$code" in
    2*) echo "OK    $name  HTTP $code  ${elapsed}s" ;;
    000) echo "FAIL  $name  UNREACHABLE"; FAIL=$((FAIL+1)) ;;
    *) echo "FAIL  $name  HTTP $code  ${elapsed}s"; FAIL=$((FAIL+1)) ;;
  esac
}

echo "=== Lab systems diagnosis ==="
date -u
echo

check "GhostGrid health" "https://ghostgrid.dannygc.cloud/api/health" 5
check "GhostGrid stats" "https://ghostgrid.dannygc.cloud/api/ghostgrid/stats" 5
check "ABX verify" "https://ghostgrid.dannygc.cloud/api/abx/verify" 5
check "ABX health" "https://ghostgrid.dannygc.cloud/api/abx/health" 5
check "GhostGrid adversarial pulse (often broken)" "https://ghostgrid.dannygc.cloud/api/ghostgrid/adversarial/pulse" 8
check "Lab health" "https://lab.dannygc.cloud/api/health" 5
check "Lab GhostGrid load (must be <15s for UI)" "https://lab.dannygc.cloud/api/ops/ghostgrid/load" 20
check "Lab services dashboard (GPU panels)" "https://lab.dannygc.cloud/api/ops/services/dashboard" 20
check "Lab local server metrics" "https://lab.dannygc.cloud/api/ops/servers/local" 8
check "Aegis protect health" "https://lab.dannygc.cloud/protect/api/health" 8
check "AI /v1/models (GPU peer)" "https://ai.dannygc.cloud/v1/models" 8

echo
if [[ -f /tmp/diag_body ]]; then
  echo "Last body (truncated):"
  head -c 240 /tmp/diag_body; echo
fi

echo
echo "Failures: $FAIL"
echo "If GhostGrid load > 15s → SPA shows OFFLINE even when GhostGrid is healthy."
echo "Apply: lab-systems-fix/hostman-console-systems-fix.sh on Hostman."
exit "$FAIL"

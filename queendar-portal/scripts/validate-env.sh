#!/bin/bash
set -e
cd "$(dirname "$0")/.."

missing=0
if [[ ! -f .env ]]; then
  echo "Missing .env — copy from .env.example"
  missing=1
fi

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
  if [[ -z "${ADMIN_API_KEY:-}" ]]; then
    echo "WARN: ADMIN_API_KEY is empty — cannot create performers via API"
  fi
fi

if [[ $missing -eq 1 ]]; then
  exit 1
fi

echo "OK: queendar-portal env validated"

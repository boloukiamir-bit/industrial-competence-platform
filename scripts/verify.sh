#!/usr/bin/env bash
# One-command verification gate before shipping: build + optional dev server + cockpit smoke.
# Usage: npm run verify
#        COOKIE="sb-...=..." npm run verify
#        SERVER=no npm run verify   # skip starting server (use existing)
# Repo should have executable bit: chmod +x scripts/verify.sh
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:5001}"
COOKIE="${COOKIE:-}"
SERVER="${SERVER:-auto}"
DEV_PID=""
DEV_LOG=""

cleanup() {
  if [ -n "$DEV_PID" ] && kill -0 "$DEV_PID" 2>/dev/null; then
    kill "$DEV_PID" 2>/dev/null || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
  [ -n "$DEV_LOG" ] && [ -f "$DEV_LOG" ] && rm -f "$DEV_LOG"
}
trap cleanup EXIT

echo "=== verify ==="
echo "BASE=$BASE  COOKIE=${COOKIE:+set}  SERVER=$SERVER"
echo ""

# Step 1: clean build artifact
echo "Step 1: rm -rf .next"
rm -rf .next

# Step 2: build
echo "Step 2: npm run build"
npm run build
echo ""

# Step 3: ensure server running (only if SERVER=auto)
if [ "$SERVER" = "auto" ]; then
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/version" 2>/dev/null) || true
  [ -z "$CODE" ] && CODE=000
  if [ "$CODE" = "200" ]; then
    echo "Step 3: server already running at $BASE"
  else
    echo "Step 3: starting dev server (wait up to 20s)..."
    DEV_LOG=$(mktemp)
    ( npm run dev > "$DEV_LOG" 2>&1 ) &
    DEV_PID=$!
    i=0
    while [ "$i" -lt 20 ]; do
      sleep 1
      i=$(( i + 1 ))
      CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/api/version" 2>/dev/null) || true
      [ -z "$CODE" ] && CODE=000
      if [ "$CODE" = "200" ]; then
        echo "Step 3: server ready"
        break
      fi
      if [ "$i" -eq 20 ]; then
        echo "FAIL: server did not respond with 200 at $BASE/api/version within 20s"
        exit 1
      fi
    done
  fi
else
  echo "Step 3: skip (SERVER=$SERVER)"
fi
echo ""

# Step 4: unauth smoke
echo "Step 4: npm run smoke:cockpit (unauth)"
BASE="$BASE" npm run smoke:cockpit
echo ""

# Step 5: auth smoke if COOKIE set
if [ -n "$COOKIE" ]; then
  echo "Step 5: npm run smoke:cockpit (auth)"
  BASE="$BASE" COOKIE="$COOKIE" npm run smoke:cockpit
else
  echo "Step 5: skip (no COOKIE)"
fi
echo ""

echo "=== verify passed ==="
exit 0

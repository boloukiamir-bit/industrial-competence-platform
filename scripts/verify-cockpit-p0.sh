#!/usr/bin/env bash
# P0 Cockpit UI fix verification. Run in <60s.
# Auth: browser cookie (DevTools → Application → Cookies → sb-*-auth-token) or COOKIES env or .dev-cockpit-cookies (dev-only).
#
# PROOF:
#   With date=2026-01-30 and shift_code=Day (no line param), API must return 12 issues.
#   UI must call /api/cockpit/issues?date=2026-01-30&shift_code=Day (NOT shift=, NOT shiftCode=).
set -e
BASE="${BASE_URL:-http://localhost:5001}"
DATE="${DATE:-2026-01-30}"
SHIFT="Day"
COOKIES="${COOKIES:-}"
[ -z "$COOKIES" ] && [ -f ".dev-cockpit-cookies" ] && COOKIES=$(cat ".dev-cockpit-cookies")
CURL_OPTS=(-s)
[ -n "$COOKIES" ] && CURL_OPTS+=(-H "Cookie: $COOKIES")

echo "=== 1) whoami ==="
WHOAMI=$(curl "${CURL_OPTS[@]}" "${BASE}/api/auth/whoami")
echo "$WHOAMI" | jq -c '.authenticated, .has_auth_cookie'
if [ "$(echo "$WHOAMI" | jq -r '.authenticated')" != "true" ]; then
  echo "FAIL: Not authenticated. Copy cookie from browser or set COOKIES= or use .dev-cockpit-cookies"
  exit 1
fi

echo ""
echo "=== 2) Summary (exact URL: date + shift_code, no shift=) ==="
SUMMARY_URL="${BASE}/api/cockpit/summary?date=${DATE}&shift_code=${SHIFT}"
echo "GET $SUMMARY_URL"
SUMMARY=$(curl "${CURL_OPTS[@]}" "$SUMMARY_URL")
ACTIVE=$(echo "$SUMMARY" | jq -r '.active_total // "null"')
echo "active_total=$ACTIVE"

echo ""
echo "=== 3) Issues (exact URL: date + shift_code) ==="
ISSUES_URL="${BASE}/api/cockpit/issues?date=${DATE}&shift_code=${SHIFT}"
echo "GET $ISSUES_URL"
ISSUES=$(curl "${CURL_OPTS[@]}" "$ISSUES_URL")
OK=$(echo "$ISSUES" | jq -r '.ok // false')
LEN=$(echo "$ISSUES" | jq -r 'if .issues != null then (.issues | length) else 0 end')
echo "ok=$OK issuesLength=$LEN"

echo ""
EXPECTED="${EXPECTED_ISSUES:-12}"
if [ "$OK" = "true" ] && [ "$LEN" = "$EXPECTED" ]; then
  echo "PASS: ok=true issuesLength=$LEN (date=${DATE} shift_code=${SHIFT})"
  exit 0
fi
echo "FAIL: expected ok=true issuesLength=$EXPECTED, got ok=$OK issuesLength=$LEN (override: EXPECTED_ISSUES=$LEN)"
exit 1

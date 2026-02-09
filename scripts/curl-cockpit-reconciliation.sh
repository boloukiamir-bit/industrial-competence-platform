#!/usr/bin/env bash
# Cockpit Summary vs Issues reconciliation test.
# Run with auth cookies. Example (replace DATE, SHIFT, LINE with values from your cockpit):
#
#   DATE=2026-02-07 SHIFT=Day ./scripts/curl-cockpit-reconciliation.sh
#
# Get cookie from browser: DevTools -> Application -> Cookies -> sb-<ref>-auth-token
#   COOKIES="sb-bmvawfrnlpdvcmffqrzc-auth-token=<value>" ./scripts/curl-cockpit-reconciliation.sh
#
# First verify auth: curl -s "http://localhost:5001/api/auth/whoami" -H "Cookie: \$COOKIES"
# See docs/CURL_AUTH.md for full curl instructions.

set -e
BASE="${BASE_URL:-http://localhost:5001}"
DATE="${DATE:-$(date +%Y-%m-%d)}"
SHIFT="${SHIFT:-Day}"
LINE="${LINE:-}"

PARAMS="date=${DATE}&shift=${SHIFT}"
[ -n "$LINE" ] && PARAMS="${PARAMS}&line=${LINE}"
[ "${DEBUG:-0}" = "1" ] && PARAMS="${PARAMS}&debug=1"
CURL_OPTS=(-s)
[ -n "$COOKIES" ] && CURL_OPTS+=(-H "Cookie: $COOKIES")

echo "=== Cockpit reconciliation test ==="
echo "BASE=$BASE DATE=$DATE SHIFT=$SHIFT LINE=$LINE"
echo ""

if [ -n "$COOKIES" ]; then
  echo "0) Auth check (whoami):"
  WHOAMI=$(curl "${CURL_OPTS[@]}" "${BASE}/api/auth/whoami")
  echo "$WHOAMI" | jq '.'
  if [ "$(echo "$WHOAMI" | jq -r '.authenticated')" != "true" ]; then
    echo "   WARNING: Not authenticated. Check COOKIES. See docs/CURL_AUTH.md"
    echo "   Error: $(echo "$WHOAMI" | jq -r '.error // "unknown"')"
    echo ""
  else
    echo "   OK: authenticated as $(echo "$WHOAMI" | jq -r '.user.email')"
    echo ""
  fi
fi

echo "1) Summary (active_total, active_blocking):"
SUMMARY=$(curl "${CURL_OPTS[@]}" "${BASE}/api/cockpit/summary?${PARAMS}")
echo "$SUMMARY" | jq '.'
ACTIVE_TOTAL=$(echo "$SUMMARY" | jq -r 'if .active_total != null then .active_total else "ERROR" end')
echo "   -> active_total: $ACTIVE_TOTAL"
echo ""

echo "2) Issues (array length):"
ISSUES=$(curl "${CURL_OPTS[@]}" "${BASE}/api/cockpit/issues?${PARAMS}")
echo "$ISSUES" | jq '{ ok, issues_count: (.issues | length), _debug }'
[ "${DEBUG:-0}" = "1" ] && echo "   Debug: org_id, site_id, date, shift_code, raw_count_before_status, raw_count_after_status"
ISSUES_LEN=$(echo "$ISSUES" | jq 'if .issues != null then (.issues | length) else "ERROR" end')
echo "   -> issues.length: $ISSUES_LEN"
echo ""

echo "3) Assertion:"
if [ "$ACTIVE_TOTAL" = "ERROR" ] || [ "$ISSUES_LEN" = "ERROR" ]; then
  echo "   ERROR: API returned an error. Check Summary/Issues response above."
  exit 1
elif [ "$ACTIVE_TOTAL" = "$ISSUES_LEN" ]; then
  echo "   OK: active_total ($ACTIVE_TOTAL) == issues.length ($ISSUES_LEN)"
else
  echo "   FAIL: active_total ($ACTIVE_TOTAL) != issues.length ($ISSUES_LEN)"
  exit 1
fi

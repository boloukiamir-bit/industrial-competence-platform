#!/usr/bin/env bash
# P0 cockpit drilldown proof: PASS if raw_rows_count>0 for a known issue station (2026-01-30 Day).
# Calls drilldown with debug=1; prints usedDateColumn, acceptedShiftCodes, raw_rows_count.
# Auth: whoami (browser cookies). Fallback: .dev-cockpit-cookies (dev-only).
# Usage:
#   export COOKIES='sb-xxx-auth-token=YYY'
#   bash scripts/prove-cockpit-drilldown.sh
set -e
BASE="${BASE_URL:-http://localhost:5001}"
DATE="${DATE:-2026-01-30}"
SHIFT="${SHIFT:-Day}"
COOKIES="${COOKIES:-}"
if [ -z "$COOKIES" ] && [ -f ".dev-cockpit-cookies" ]; then
  COOKIES=$(cat ".dev-cockpit-cookies")
fi
CURL_OPTS=(-s)
[ -n "$COOKIES" ] && CURL_OPTS+=(-H "Cookie: $COOKIES")

# 1) whoami
WHOAMI=$(curl "${CURL_OPTS[@]}" "${BASE}/api/auth/whoami")
AUTH=$(echo "$WHOAMI" | jq -r '.authenticated // "false"')
if [ "$AUTH" != "true" ]; then
  echo "FAIL: Not authenticated. Set COOKIES env or .dev-cockpit-cookies (browser: DevTools→Application→Cookies→sb-*-auth-token)."
  exit 1
fi

# 2) First issue from issues list
ISSUES=$(curl "${CURL_OPTS[@]}" "${BASE}/api/cockpit/issues?date=${DATE}&shift_code=${SHIFT}")
OK=$(echo "$ISSUES" | jq -r '.ok // false')
if [ "$OK" != "true" ]; then
  echo "FAIL: issues API not ok"
  exit 1
fi
FIRST_NO_GO=$(echo "$ISSUES" | jq -r '[.issues[] | select(.issue_type == "NO_GO" or .severity == "BLOCKING")][0]')
if [ "$FIRST_NO_GO" = "null" ] || [ -z "$FIRST_NO_GO" ]; then
  FIRST_ISSUE=$(echo "$ISSUES" | jq -r '.issues[0]')
  STATION_ID=$(echo "$FIRST_ISSUE" | jq -r '.station_id // empty')
else
  STATION_ID=$(echo "$FIRST_NO_GO" | jq -r '.station_id // empty')
fi
if [ -z "$STATION_ID" ] || [ "$STATION_ID" = "null" ]; then
  echo "FAIL: No issue with station_id (no issues or missing station_id)"
  exit 1
fi

# 3) Drilldown with debug=1
DRILL=$(curl "${CURL_OPTS[@]}" "${BASE}/api/cockpit/issues/drilldown?date=${DATE}&shift_code=${SHIFT}&station_id=${STATION_ID}&debug=1")
DOK=$(echo "$DRILL" | jq -r '.ok // false')

if [ "$DOK" != "true" ]; then
  echo "FAIL: drilldown API not ok: $(echo "$DRILL" | jq -r '.error // .')"
  echo "supabase_error: $(echo "$DRILL" | jq -r '.supabase_error // empty')"
  echo "debug: $(echo "$DRILL" | jq -r '._debug // .debug // empty')"
  echo "attempt: $(echo "$DRILL" | jq -r '.attempt // empty')"
  exit 1
fi

# 4) Print debug fields
USED_DATE_COL=$(echo "$DRILL" | jq -r '._debug.usedDateColumn // "—"')
ACCEPTED_SHIFTS=$(echo "$DRILL" | jq -r '._debug.acceptedShiftCodes // [] | join(", ")')
RAW_ROWS=$(echo "$DRILL" | jq -r '._debug.raw_rows_count // 0')
echo "usedDateColumn=$USED_DATE_COL acceptedShiftCodes=$ACCEPTED_SHIFTS raw_rows_count=$RAW_ROWS"

# 5) PASS if raw_rows_count > 0
if [ "$RAW_ROWS" -gt 0 ]; then
  echo "PASS raw_rows_count=${RAW_ROWS}"
  exit 0
fi
echo "FAIL raw_rows_count=${RAW_ROWS} (expected >0 for station ${STATION_ID} on ${DATE} ${SHIFT})"
exit 1

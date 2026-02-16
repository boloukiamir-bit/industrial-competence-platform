#!/usr/bin/env bash
# Verify roster-scoped compliance matrix endpoint (authenticated).
# Usage: BASE_URL=http://localhost:5001 DATE=2026-02-13 SHIFT=S1 COOKIES="sb-..." ./scripts/verify_compliance_matrix_api.sh
# Auth: browser cookie (DevTools → Application → Cookies → sb-*-auth-token) or COOKIES env or .dev-cockpit-cookies
set -e
BASE="${BASE_URL:-http://localhost:5001}"
DATE="${DATE:-2026-02-13}"
SHIFT="${SHIFT:-S1}"
COOKIES="${COOKIES:-}"
TOKEN="${TOKEN:-}"
[ -z "$COOKIES" ] && [ -f ".dev-cockpit-cookies" ] && COOKIES=$(cat ".dev-cockpit-cookies")
CURL_OPTS=(-s)
[ -n "$TOKEN" ] && CURL_OPTS+=(-H "Authorization: Bearer $TOKEN")
[ -z "$TOKEN" ] && [ -n "$COOKIES" ] && CURL_OPTS+=(-H "Cookie: $COOKIES")

echo "=== 1) whoami ==="
WHOAMI=$(curl "${CURL_OPTS[@]}" "${BASE}/api/auth/whoami")
echo "$WHOAMI" | jq -c '.authenticated, .has_auth_cookie'
if [ "$(echo "$WHOAMI" | jq -r '.authenticated')" != "true" ]; then
  echo "FAIL: Not authenticated. Use TOKEN= or COOKIES= or .dev-cockpit-cookies"
  exit 1
fi

echo ""
echo "=== 2) Compliance matrix roster-scoped ==="
URL="${BASE}/api/compliance/matrix?date=${DATE}&shift_code=${SHIFT}"
echo "GET $URL"
RES=$(curl "${CURL_OPTS[@]}" "$URL")
OK=$(echo "$RES" | jq -r '.ok // false')
ROSTER=$(echo "$RES" | jq -r '.roster_employees_count // -1')
BLOCKERS=$(echo "$RES" | jq -r '.kpis.blockers_count // -1')
EXPIRING=$(echo "$RES" | jq -r '.kpis.expiring_count // -1')
VALID=$(echo "$RES" | jq -r '.kpis.valid_count // -1')
MISSING=$(echo "$RES" | jq -r '.kpis.missing_count // -1')
TOP_BLOCKERS_LEN=$(echo "$RES" | jq -r 'if .top_blockers != null then (.top_blockers | length) else 0 end')

echo "ok=$OK roster_employees_count=$ROSTER blockers=$BLOCKERS expiring=$EXPIRING valid=$VALID missing=$MISSING top_blockers_len=$TOP_BLOCKERS_LEN"

if [ "$OK" != "true" ]; then
  echo "FAIL: ok != true"
  exit 1
fi

if [ "$ROSTER" = "0" ]; then
  if [ "$BLOCKERS" = "0" ] && [ "$EXPIRING" = "0" ] && [ "$VALID" = "0" ] && [ "$MISSING" = "0" ] && [ "$TOP_BLOCKERS_LEN" = "0" ]; then
    echo "PASS: roster_employees_count=0 -> KPIs all zero and top_blockers empty"
    exit 0
  fi
  echo "FAIL: roster_employees_count=0 but KPIs/top_blockers not empty"
  exit 1
fi

echo "FAIL: roster_employees_count is not 0; cannot assert empty KPIs"
exit 1

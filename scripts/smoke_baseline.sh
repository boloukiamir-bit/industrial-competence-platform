#!/usr/bin/env bash
# Smoke-test baseline endpoints: onboarding, compliance action-inbox, bulk-upsert.
# Auth: cookies (browser or COOKIES env or .dev-cockpit-cookies) or DEV_BEARER_TOKEN.
# Usage: BASE_URL=http://localhost:5001 ./scripts/smoke_baseline.sh

set -e
BASE="${BASE_URL:-http://localhost:5001}"
COOKIES="${COOKIES:-}"
TOKEN="${DEV_BEARER_TOKEN:-}"
[ -z "$COOKIES" ] && [ -f ".dev-cockpit-cookies" ] && COOKIES=$(cat ".dev-cockpit-cookies")

CURL_OPTS=(-s -w "\n%{http_code}")
[ -n "$TOKEN" ] && CURL_OPTS+=(-H "Authorization: Bearer $TOKEN")
[ -z "$TOKEN" ] && [ -n "$COOKIES" ] && CURL_OPTS+=(-H "Cookie: $COOKIES")

run() {
  local name="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local out
  local code
  if [ "$method" = "GET" ]; then
    out=$(curl "${CURL_OPTS[@]}" -X GET "$url" 2>/dev/null) || { echo "FAIL	$name	curl failed"; return; }
  else
    out=$(curl "${CURL_OPTS[@]}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null) || { echo "FAIL	$name	curl failed"; return; }
  fi
  code=$(echo "$out" | tail -n1)
  body=$(echo "$out" | sed '$d')
  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    echo "PASS	$name	$code"
  elif [ "$code" = "400" ] || [ "$code" = "401" ] || [ "$code" = "403" ] || [ "$code" = "422" ]; then
    echo "PASS	$name	$code (auth/validation)"
  else
    echo "FAIL	$name	$code	${body:0:120}"
  fi
}

echo "Smoke baseline (BASE=$BASE)"
echo "---"
echo "Result	Endpoint	Detail"
echo "---"

# 1) GET /api/onboarding/status
run "GET /api/onboarding/status" "GET" "${BASE}/api/onboarding/status"

# 2) GET /api/onboarding/templates/stations (download one template)
run "GET /api/onboarding/templates/stations" "GET" "${BASE}/api/onboarding/templates/stations"

# 3) POST /api/onboarding/stations/preview (minimal CSV)
STATIONS_CSV="site_name,area_name,station_name,station_code
Test Site,Test Area,Test Station,TS1"
run "POST /api/onboarding/stations/preview" "POST" "${BASE}/api/onboarding/stations/preview" "{\"csv\":$(echo "$STATIONS_CSV" | jq -Rs .)}"

# 4) POST /api/onboarding/stations/apply (same payload; may 403 if not admin/hr)
run "POST /api/onboarding/stations/apply" "POST" "${BASE}/api/onboarding/stations/apply" "{\"csv\":$(echo "$STATIONS_CSV" | jq -Rs .)}"

# 5) POST /api/onboarding/shift-patterns/preview (minimal CSV)
SHIFT_CSV="site_name,shift_code,start_time,end_time,break_minutes
Test Site,S1,06:00,14:00,30"
run "POST /api/onboarding/shift-patterns/preview" "POST" "${BASE}/api/onboarding/shift-patterns/preview" "{\"csv\":$(echo "$SHIFT_CSV" | jq -Rs .)}"

# 6) POST /api/onboarding/shift-patterns/apply
run "POST /api/onboarding/shift-patterns/apply" "POST" "${BASE}/api/onboarding/shift-patterns/apply" "{\"csv\":$(echo "$SHIFT_CSV" | jq -Rs .)}"

# 7) POST /api/onboarding/bootstrap (placeholder; expect 404/422 if no such site)
run "POST /api/onboarding/bootstrap" "POST" "${BASE}/api/onboarding/bootstrap" '{"site_id":"00000000-0000-0000-0000-000000000000","date":"2026-02-13","shift_code":"S1"}'

# 8) GET /api/compliance/matrix/action-inbox
run "GET /api/compliance/matrix/action-inbox" "GET" "${BASE}/api/compliance/matrix/action-inbox"

# 9) POST /api/compliance/employee/bulk-upsert (minimal patch; empty employee_ids may 400)
run "POST /api/compliance/employee/bulk-upsert" "POST" "${BASE}/api/compliance/employee/bulk-upsert" '{"employee_ids":[],"patch":{"notesMerge":{"owner":"smoke"}}}'

echo "---"

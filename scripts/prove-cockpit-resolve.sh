#!/usr/bin/env bash
# P0 cockpit resolve proof: POST decision -> issue resolved (missing or resolved=true).
# Usage:
#   export COOKIES='sb-bmvawfrnlpdvcmffqrzc-auth-token=XXX'
#   bash scripts/prove-cockpit-resolve.sh
# Fallback: .dev-cockpit-cookies
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

# a) whoami
WHOAMI=$(curl "${CURL_OPTS[@]}" "${BASE}/api/auth/whoami")
AUTH=$(echo "$WHOAMI" | jq -r '.authenticated // "false"')
if [ "$AUTH" != "true" ]; then
  echo "FAIL: Not authenticated. Set COOKIES env."
  exit 1
fi

# b) GET issues -> pick first
ISSUES1=$(curl "${CURL_OPTS[@]}" "${BASE}/api/cockpit/issues?date=${DATE}&shift_code=${SHIFT}")
OK1=$(echo "$ISSUES1" | jq -r '.ok // "false"')
if [ "$OK1" != "true" ]; then
  echo "FAIL: GET issues failed: $(echo "$ISSUES1" | jq -r '.error // .')"
  exit 1
fi
COUNT1=$(echo "$ISSUES1" | jq -r '.issues | length')
STATION_ID=$(echo "$ISSUES1" | jq -r '.issues[0].station_id // empty')
ISSUE_TYPE=$(echo "$ISSUES1" | jq -r '.issues[0] | if .issue_type then .issue_type elif .severity == "BLOCKING" then "NO_GO" else "WARNING" end')
if [ -z "$STATION_ID" ]; then
  echo "FAIL: No issues to resolve (count=$COUNT1)"
  exit 1
fi
echo "Issues before: $COUNT1 | first: station_id=$STATION_ID issue_type=$ISSUE_TYPE"

# c) POST decision acknowledge
POST_BODY=$(jq -n \
  --arg date "$DATE" \
  --arg shift "$SHIFT" \
  --arg station "$STATION_ID" \
  --arg issue_type "${ISSUE_TYPE:-NO_GO}" \
  '{date: $date, shift_code: $shift, station_id: $station, issue_type: $issue_type, action: "acknowledged"}')
DECISION=$(curl "${CURL_OPTS[@]}" -X POST "${BASE}/api/cockpit/issues/decisions" \
  -H "Content-Type: application/json" \
  -d "$POST_BODY")
OK_POST=$(echo "$DECISION" | jq -r '.ok // "false"')
if [ "$OK_POST" != "true" ]; then
  echo "FAIL: POST decision failed: $(echo "$DECISION" | jq -r '.error // .')"
  exit 1
fi
TARGET_ID=$(echo "$DECISION" | jq -r '.target_id // "unknown"')
DECISION_ID=$(echo "$DECISION" | jq -r '.decision_id // .decision.id // "unknown"')
if ! echo "$TARGET_ID" | grep -qE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; then
  echo "FAIL: target_id is not UUID format: $TARGET_ID"
  exit 1
fi
echo "target_id=$TARGET_ID decision_id=$DECISION_ID"

# d) GET issues again (show_resolved=false default)
ISSUES2=$(curl "${CURL_OPTS[@]}" "${BASE}/api/cockpit/issues?date=${DATE}&shift_code=${SHIFT}")
OK2=$(echo "$ISSUES2" | jq -r '.ok // "false"')
COUNT2=$(echo "$ISSUES2" | jq -r '.issues | length')
FOUND_RESOLVED=$(echo "$ISSUES2" | jq -r --arg sid "$STATION_ID" '[.issues[]? | select(.station_id == $sid)] | length')
echo "Issues after (show_resolved=false): $COUNT2"

# e) Verify: issue must be gone (count2 = count1-1) OR present with resolved=true when show_resolved=true
ISSUES3=$(curl "${CURL_OPTS[@]}" "${BASE}/api/cockpit/issues?date=${DATE}&shift_code=${SHIFT}&show_resolved=1")
OUR_ISSUE=$(echo "$ISSUES3" | jq -r --arg sid "$STATION_ID" --arg it "$ISSUE_TYPE" '[.issues[]? | select(.station_id == $sid and (.issue_type // "NO_GO") == $it)][0]')
RESOLVED_FLAG=$(echo "$OUR_ISSUE" | jq -r 'if . == null or . == "" then "false" else (.resolved // "false") end')

if [ "$COUNT2" -eq "$((COUNT1 - 1))" ] || [ "$RESOLVED_FLAG" = "true" ]; then
  echo "PASS target_id=$TARGET_ID decision_id=$DECISION_ID (issue resolved)"
  exit 0
fi
echo "FAIL: issue not resolved. Before=$COUNT1 after=$COUNT2 resolved=$RESOLVED_FLAG"
exit 1

#!/usr/bin/env bash
# P0 cockpit issues proof: PASS if raw_count_after_status==12 AND active_total==issuesLength==12.
# Usage:
#   export COOKIES='sb-bmvawfrnlpdvcmffqrzc-auth-token=XXX'
#   bash scripts/prove-cockpit-issues.sh
# Fallback (dev): COOKIES from env, or use token from file if COOKIES unset.
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
  echo "FAIL: Not authenticated. Set COOKIES env (browser: DevTools→Application→Cookies→sb-*-auth-token)."
  exit 1
fi

# b) cockpit lines: must not contain BEA or legacy demo lines
LINES_JSON=$(curl "${CURL_OPTS[@]}" "${BASE}/api/cockpit/lines?date=${DATE}&shift_code=${SHIFT}")
BEA_COUNT=$(echo "$LINES_JSON" | jq -r '[.lines[]? | select(. == "BEA" or . == "Bearbetning" or . == "Pressline 1" or . == "Assembly" or . == "Quality Control")] | length')
if [ "$BEA_COUNT" != "0" ] && [ "$BEA_COUNT" != "null" ]; then
  echo "FAIL: cockpit/lines must not return BEA or legacy lines (found $BEA_COUNT)"
  exit 1
fi
echo "cockpit/lines: no BEA or legacy lines"

# c) summary
SUMMARY=$(curl "${CURL_OPTS[@]}" "${BASE}/api/cockpit/summary?date=${DATE}&shift_code=${SHIFT}&debug=1")
RAW_BEFORE=$(echo "$SUMMARY" | jq -r '._debug.raw_count_before_status // "null"')
RAW_AFTER=$(echo "$SUMMARY" | jq -r '._debug.raw_count_after_status // "null"')
ACTIVE_TOTAL=$(echo "$SUMMARY" | jq -r '.active_total // "null"')
echo "raw_count_before_status=$RAW_BEFORE raw_count_after_status=$RAW_AFTER active_total=$ACTIVE_TOTAL"

# d) issues
ISSUES=$(curl "${CURL_OPTS[@]}" "${BASE}/api/cockpit/issues?date=${DATE}&shift_code=${SHIFT}&debug=1")
ISSUES_LEN=$(echo "$ISSUES" | jq -r 'if .issues != null then (.issues | length | tostring) else "null" end')
echo "issuesLength=$ISSUES_LEN"

# e) PASS/FAIL
if [ "$RAW_AFTER" = "12" ] && [ "$ACTIVE_TOTAL" = "12" ] && [ "$ISSUES_LEN" = "12" ]; then
  echo "PASS raw_count_after_status=12 active_total=12 issuesLength=12"
  exit 0
fi
echo "FAIL raw_count_after_status=$RAW_AFTER active_total=$ACTIVE_TOTAL issuesLength=$ISSUES_LEN (expected 12 12 12)"
exit 1

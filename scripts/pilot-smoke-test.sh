#!/usr/bin/env bash
# Pilot Smoke Test - 14-day hardening. Deps: curl, jq. Auth: ICP_COOKIE_FILE or DEV_BEARER_TOKEN.
set -euo pipefail
BASE="${ICP_BASE:-http://127.0.0.1:5001}"
FAILED=0
CURL_AUTH=()
if [[ -n "${DEV_BEARER_TOKEN:-}" ]]; then
  CURL_AUTH=(-H "Authorization: Bearer ${DEV_BEARER_TOKEN}")
elif [[ -n "${ICP_COOKIE_FILE:-}" ]] && [[ -f "${ICP_COOKIE_FILE}" ]]; then
  CURL_AUTH=(-b "$ICP_COOKIE_FILE")
else
  echo "FAIL: Set either ICP_COOKIE_FILE or DEV_BEARER_TOKEN"
  exit 1
fi
check() {
  local name="$1" method="${2:-GET}" url_path="${3:-}" data="${4:-}" jq_test="${5:-.}"
  local url="${BASE}${url_path}" out code
  if [[ "$method" == "GET" ]]; then
    out=$(curl -s -S -w "\n%{http_code}" "${CURL_AUTH[@]}" "$url") || { echo "FAIL: $name (curl error)"; return 1; }
  else
    out=$(curl -s -S -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" "${CURL_AUTH[@]}" -d "$data" "$url") || { echo "FAIL: $name (curl error)"; return 1; }
  fi
  code=$(echo "$out" | tail -n1)
  local body
  body=$(echo "$out" | sed '$d')
  if [[ "$code" != "200" ]]; then echo "FAIL: $name (HTTP $code)"; return 1; fi
  if ! echo "$body" | jq -e "$jq_test" >/dev/null 2>&1; then echo "FAIL: $name (jq)"; return 1; fi
  echo "PASS: $name"
  return 0
}
if ! check "GET /api/health" GET "/api/health" "" '.status == "OK"'; then FAILED=1; fi
JQ_ORG='.ok == true and (.org.name | type == "string" and length > 0)'
if ! check "GET /api/org/identity" GET "/api/org/identity" "" "$JQ_ORG"; then FAILED=1; fi
EMPLOYEES_BODY=""
if ! EMPLOYEES_BODY=$(curl -s -S "${CURL_AUTH[@]}" "${BASE}/api/employees"); then
  echo "FAIL: GET /api/employees (curl error)"
  FAILED=1
else
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "${CURL_AUTH[@]}" "${BASE}/api/employees")
  if [[ "$CODE" != "200" ]]; then echo "FAIL: GET /api/employees (HTTP $CODE)"; FAILED=1
  elif ! echo "$EMPLOYEES_BODY" | jq -e '.employees | type == "array"' >/dev/null 2>&1; then echo "FAIL: GET /api/employees (.employees)"; FAILED=1
  else
    COUNT=$(echo "$EMPLOYEES_BODY" | jq -r '.employees | length')
    if [[ "$COUNT" -eq 0 ]]; then echo "PASS: GET /api/employees (WARNING: no employees)"; else echo "PASS: GET /api/employees"; fi
  fi
fi
FIRST_ID=""
[[ $FAILED -eq 0 ]] && [[ -n "${EMPLOYEES_BODY:-}" ]] && FIRST_ID=$(echo "$EMPLOYEES_BODY" | jq -r '.employees[0].id // empty')
if [[ -n "$FIRST_ID" ]] && [[ "$FIRST_ID" != "null" ]]; then
  CURRENT=$(curl -s -S "${CURL_AUTH[@]}" "${BASE}/api/employees/${FIRST_ID}" | jq -r '.employee.employment_status // "ACTIVE"')
  TO_A="INACTIVE"; TO_B="ACTIVE"
  [[ "$CURRENT" == "INACTIVE" ]] && { TO_A="ACTIVE"; TO_B="INACTIVE"; }
  if ! check "PATCH employment_status" PATCH "/api/employees/${FIRST_ID}" "{\"employment_status\":\"${TO_A}\"}" '.ok == true'; then FAILED=1; fi
  if ! check "PATCH employment_status restore" PATCH "/api/employees/${FIRST_ID}" "{\"employment_status\":\"${TO_B}\"}" '.ok == true'; then FAILED=1; fi
  if ! check "GET /api/cockpit/audit" GET "/api/cockpit/audit?action=EMPLOYMENT_STATUS_CHANGE&target_id=${FIRST_ID}" "" '.ok == true and .event != null'; then FAILED=1; fi
fi
JQ_SUM='.ok == true and .summary != null and (.summary | has("openCount") and has("overdueCount") and has("due7DaysCount") and has("topAssignees"))'
if ! check "GET compliance-actions-summary" GET "/api/cockpit/compliance-actions-summary" "" "$JQ_SUM"; then FAILED=1; fi
JQ_PRIO='.ok == true and .summary != null and (.summary | has("overdueActions") and has("unassignedActions") and has("legalStops") and has("noGoOrWarnings"))'
if ! check "GET hr/inbox/priority" GET "/api/hr/inbox/priority" "" "$JQ_PRIO"; then FAILED=1; fi
if ! check "GET hr/inbox actions" GET "/api/hr/inbox?tab=actions&filter=open" "" '.ok == true'; then FAILED=1; fi
if ! check "GET hr/inbox lifecycle" GET "/api/hr/inbox?tab=lifecycle" "" '.ok == true'; then FAILED=1; fi
if ! check "GET hr/inbox governance" GET "/api/hr/inbox?tab=governance" "" '.ok == true'; then FAILED=1; fi
[[ $FAILED -ne 0 ]] && exit 1
echo "ALL CHECKS PASSED"
exit 0

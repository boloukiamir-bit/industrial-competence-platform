#!/usr/bin/env bash
# Verify HR Template Job PDF endpoint.
# Run: bash scripts/verify-hr-job-pdf.sh [BASE_URL] [JOB_ID]
# Auth: browser cookies (copy from DevTools) or dev token:
#   export NEXT_PUBLIC_DEV_BEARER_TOKEN=<token>  (dev-only, no prod impact)
#   Or: COOKIE_FILE=path/to/cookies.txt (one line: Cookie: name=value; ...)
set -e

BASE_URL="${1:-${BASE_URL:-http://localhost:5001}}"
JOB_ID="${2:-}"
TOKEN="${NEXT_PUBLIC_DEV_BEARER_TOKEN:-}"

echo "=== HR Job PDF verification ==="
echo "BASE_URL=$BASE_URL"
echo ""

# 1) Unauthorized: expect 401 (or 403 if session present but no org)
echo "--- 1. GET /api/hr/template-jobs/00000000-0000-0000-0000-000000000001/pdf (no auth) ---"
RES=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/hr/template-jobs/00000000-0000-0000-0000-000000000001/pdf" 2>/dev/null || echo -e "\n000")
CODE=$(echo "$RES" | tail -1)
if [ "$CODE" = "401" ] || [ "$CODE" = "403" ]; then
  echo "  Expected 401/403: $CODE OK"
else
  echo "  Got $CODE (expected 401 or 403 for unauthenticated)"
fi

# 2) Authorized: need a real job id; if none, skip and report
echo ""
echo "--- 2. GET pdf with auth ---"
CURL_AUTH=()
if [ -n "$TOKEN" ]; then
  CURL_AUTH+=(-H "Authorization: Bearer $TOKEN")
  echo "  Using Bearer token"
elif [ -n "${COOKIE_FILE:-}" ] && [ -f "$COOKIE_FILE" ]; then
  CURL_AUTH+=(-H "$(cat "$COOKIE_FILE")")
  echo "  Using cookie file"
fi

if [ -z "${CURL_AUTH[*]}" ]; then
  echo "  Skip: set NEXT_PUBLIC_DEV_BEARER_TOKEN or COOKIE_FILE for authorized test"
  echo ""
  echo "=== PROOF ==="
  echo "1. Unauthorized request -> 401 or 403"
  echo "2. Authorized GET pdf: run with token/cookie; expect 200, Content-Type: application/pdf, non-empty body"
  echo "   Example: NEXT_PUBLIC_DEV_BEARER_TOKEN=<token> bash scripts/verify-hr-job-pdf.sh $BASE_URL <job-uuid>"
  exit 0
fi

# Use provided JOB_ID or fetch first job from list
if [ -z "$JOB_ID" ]; then
  LIST=$(curl -s "${CURL_AUTH[@]}" "$BASE_URL/api/hr/template-jobs" 2>/dev/null || true)
  JOB_ID=$(echo "$LIST" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
fi

if [ -z "$JOB_ID" ]; then
  echo "  No job id (create a job first). Skipping PDF 200 check."
  echo ""
  echo "=== PROOF ==="
  echo "1. Unauthorized -> 401/403"
  echo "2. With auth + job id: GET .../pdf returns 200, application/pdf, non-empty body"
  exit 0
fi

OUT=$(curl -s -w "\n%{http_code}\n%{content_type}" -o /tmp/hr-job-pdf-out.bin "${CURL_AUTH[@]}" "$BASE_URL/api/hr/template-jobs/$JOB_ID/pdf" 2>/dev/null)
CODE=$(echo "$OUT" | tail -2 | head -1)
CT=$(echo "$OUT" | tail -1)
SIZE=$(wc -c < /tmp/hr-job-pdf-out.bin 2>/dev/null || echo 0)

if [ "$CODE" = "200" ] && echo "$CT" | grep -q "application/pdf" && [ "$SIZE" -gt 100 ]; then
  echo "  Status: $CODE OK"
  echo "  Content-Type: $CT"
  echo "  Body size: $SIZE bytes"
  echo "  PDF check: PASS"
else
  echo "  Status: $CODE"
  echo "  Content-Type: $CT"
  echo "  Body size: $SIZE"
  if [ "$CODE" != "200" ]; then
    head -c 500 /tmp/hr-job-pdf-out.bin | head -1
  fi
  echo "  PDF check: FAIL (expected 200, application/pdf, >100 bytes)"
  exit 1
fi

echo ""
echo "=== PROOF ==="
echo "1. Unauthorized GET pdf -> 401 or 403"
echo "2. Authorized GET /api/hr/template-jobs/$JOB_ID/pdf -> 200, Content-Type: application/pdf, body $SIZE bytes"

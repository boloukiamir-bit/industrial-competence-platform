#!/usr/bin/env bash
# Verification for Compliance 2.0 Executive Board (matrix page + POST /api/compliance/actions).
# Run from repo root. Optional: set BASE_URL (e.g. http://localhost:3000) to hit API; else build-only.
set -e
cd "$(dirname "$0")/.."

echo "[1/2] Build..."
npm run build
echo "Build exit: 0"

if [ -n "${BASE_URL}" ]; then
  echo "[2/2] API checks (BASE_URL=${BASE_URL})..."
  OVERVIEW=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/compliance/overview" -H "Cookie: sb-access-token=dev")
  ACTIONS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/compliance/actions" \
    -H "Content-Type: application/json" \
    -d '{"employee_id":"00000000-0000-0000-0000-000000000001","action_type":"log_decision"}')
  echo "GET /api/compliance/overview -> ${OVERVIEW}"
  echo "POST /api/compliance/actions -> ${ACTIONS}"
  # 200/201 = success; 400 = bad body; 401/403 = auth. Reject 404 (route missing) and 5xx.
  if [ "${OVERVIEW}" -eq 404 ] || [ "${OVERVIEW}" -ge 500 ]; then
    echo "Unexpected overview status ${OVERVIEW}"
    exit 1
  fi
  if [ "${ACTIONS}" -eq 404 ] || [ "${ACTIONS}" -ge 500 ]; then
    echo "Unexpected actions status ${ACTIONS}"
    exit 1
  fi
else
  echo "[2/2] Skip API (set BASE_URL to verify endpoints)"
fi
echo "OK"

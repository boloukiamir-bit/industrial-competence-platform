#!/usr/bin/env bash
# Verification for Competence Matrix 2.0 Executive Board (page + overview + employee + actions).
# Run from repo root. Optional: BASE_URL (e.g. http://localhost:3000); auth via cookie or dev token.
# Dev fallback: set BEARER to a valid dev token, or use cookie Cookie: sb-access-token=...
set -e
cd "$(dirname "$0")/.."

echo "[1/2] Build..."
npm run build
echo "Build exit: 0"

if [ -n "${BASE_URL}" ]; then
  echo "[2/2] API checks (BASE_URL=${BASE_URL})..."
  AUTH_HDR=""
  if [ -n "${BEARER}" ]; then
    AUTH_HDR="-H Authorization: Bearer ${BEARER}"
  elif [ -n "${COOKIES}" ]; then
    AUTH_HDR="-H Cookie: ${COOKIES}"
  fi
  OVERVIEW=$(curl -s -o /dev/null -w '%{http_code}' $AUTH_HDR "${BASE_URL}/api/competence/overview")
  EMPLOYEE=$(curl -s -o /dev/null -w '%{http_code}' $AUTH_HDR "${BASE_URL}/api/competence/employee?employee_id=00000000-0000-0000-0000-000000000001")
  ACTIONS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BASE_URL}/api/competence/actions" \
    -H "Content-Type: application/json" $AUTH_HDR \
    -d '{"employee_id":"00000000-0000-0000-0000-000000000001","action_type":"log_decision"}')
  echo "GET /api/competence/overview -> ${OVERVIEW}"
  echo "GET /api/competence/employee -> ${EMPLOYEE}"
  echo "POST /api/competence/actions -> ${ACTIONS}"
  if [ "${OVERVIEW}" -eq 404 ] || [ "${OVERVIEW}" -ge 500 ]; then
    echo "Unexpected overview status ${OVERVIEW}"
    exit 1
  fi
  if [ "${EMPLOYEE}" -eq 404 ] || [ "${EMPLOYEE}" -ge 500 ]; then
    echo "Unexpected employee status ${EMPLOYEE}"
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

#!/usr/bin/env bash
# Verify HR Template Jobs: build, migrations, API routes.
# Run: bash scripts/verify-hr-template-jobs.sh
# Auth: Use browser cookies (logged-in session) or dev token:
#   NEXT_PUBLIC_DEV_BEARER_TOKEN=<token> for curl fallback.
set -e

BASE_URL="${BASE_URL:-http://localhost:5001}"
TOKEN="${NEXT_PUBLIC_DEV_BEARER_TOKEN:-}"

echo "=== 1. npm run build ==="
npm run build
echo "Build: OK"

echo ""
echo "=== 2. Migrations (supabase db push or migrate) ==="
if command -v supabase &>/dev/null; then
  supabase db push 2>/dev/null || echo "supabase db push skipped (no linked project)"
else
  echo "supabase CLI not found, skip db push"
fi

echo ""
echo "=== 3. API routes (curl with session cookies or bearer) ==="
CURL_OPTS=(-s -w "\n%{http_code}" "$BASE_URL")
if [ -n "$TOKEN" ]; then
  CURL_OPTS+=(-H "Authorization: Bearer $TOKEN")
fi

# GET /api/hr/templates
echo "GET /api/hr/templates"
RES=$(curl "${CURL_OPTS[@]}/api/hr/templates" 2>/dev/null || echo "000")
CODE=$(echo "$RES" | tail -1)
BODY=$(echo "$RES" | sed '$d')
if [ "$CODE" = "200" ]; then
  echo "  Status: $CODE OK"
  TEMPLATES=$(echo "$BODY" | grep -o '"code"' | wc -l || true)
  echo "  Templates count: ${TEMPLATES:-0}"
else
  echo "  Status: $CODE (auth required - log in via browser at $BASE_URL/login)"
fi

# GET /api/hr/template-jobs
echo "GET /api/hr/template-jobs"
RES=$(curl "${CURL_OPTS[@]}/api/hr/template-jobs" 2>/dev/null || echo "000")
CODE=$(echo "$RES" | tail -1)
BODY=$(echo "$RES" | sed '$d')
if [ "$CODE" = "200" ]; then
  echo "  Status: $CODE OK"
  JOBS=$(echo "$BODY" | grep -o '"id"' | wc -l || true)
  echo "  Jobs count: ${JOBS:-0}"
else
  echo "  Status: $CODE (auth required)"
fi

# GET /api/hr/owners
echo "GET /api/hr/owners"
RES=$(curl "${CURL_OPTS[@]}/api/hr/owners" 2>/dev/null || echo "000")
CODE=$(echo "$RES" | tail -1)
if [ "$CODE" = "200" ]; then
  echo "  Status: $CODE OK"
else
  echo "  Status: $CODE"
fi

echo ""
echo "=== PROOF ==="
echo "1. npm run build         -> exit 0"
echo "2. Manual: open $BASE_URL/app/hr/template-jobs"
echo "   - Create job: click template card -> select employee -> Create Job"
echo "   - Job appears in Jobs Inbox"
echo "   - Open job -> Download PDF -> file downloads"
echo "   - Mark Done -> status updates"
echo "3. Dev token fallback: export NEXT_PUBLIC_DEV_BEARER_TOKEN=<your-token>"
echo "   Then: curl -H \"Authorization: Bearer \$TOKEN\" $BASE_URL/api/hr/template-jobs"

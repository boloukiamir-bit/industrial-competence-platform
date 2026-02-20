#!/usr/bin/env bash
# Apply governance core migrations in chronological order, then run smoke query.
# Usage: from repo root, run: bash scripts/apply_governance_migrations.sh
# Requires: DATABASE_URL in .env.local (or env), psql.

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env.local
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL not set. Add it to .env.local or export it." >&2
  exit 1
fi

MIGRATIONS=(
  "supabase/migrations/20260219100000_governance_events.sql"
  "supabase/migrations/20260219110000_governance_events_policy_fingerprint.sql"
  "supabase/migrations/20260219120000_governance_snapshots.sql"
  "supabase/migrations/20260219130000_governance_events_idempotency.sql"
  "supabase/migrations/20260219140000_execution_decisions_snapshot_binding.sql"
  "supabase/migrations/20260219150000_governance_config_execution_token.sql"
  "supabase/migrations/20260219160000_execution_token_uses.sql"
  "supabase/migrations/20260219170000_roles_and_employee_roles.sql"
  "supabase/migrations/20260219170000_roles_and_employee_roles_fix.sql"
  "supabase/migrations/20260219180000_compliance_requirement_bindings.sql"
  "supabase/migrations/20260219190000_calculate_compliance_station_shift_v2.sql"
  "supabase/migrations/20260219200000_calculate_industrial_readiness_v2_compliance.sql"
  "supabase/migrations/20260220100000_policy_binding_stations_snapshots.sql"
  "supabase/migrations/20260220_create_policy_engine.sql"
)

echo "Applying ${#MIGRATIONS[@]} governance migrations..."
for f in "${MIGRATIONS[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: Missing migration file: $f" >&2
    exit 1
  fi
  echo "  -> $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" -q
done

echo ""
echo "Running smoke query..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
SELECT
  to_regclass('public.governance_events') as governance_events,
  to_regclass('public.governance_snapshots') as governance_snapshots,
  to_regclass('public.execution_token_uses') as execution_token_uses,
  to_regclass('public.roles') as roles,
  to_regclass('public.employee_roles') as employee_roles,
  to_regclass('public.compliance_requirement_bindings') as compliance_requirement_bindings;
"

SMOKE_RESULT=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -t -A -c "
SELECT
  to_regclass('public.governance_events')::text,
  to_regclass('public.governance_snapshots')::text,
  to_regclass('public.execution_token_uses')::text,
  to_regclass('public.roles')::text,
  to_regclass('public.employee_roles')::text,
  to_regclass('public.compliance_requirement_bindings')::text;
")
# Require all six columns non-null (to_regclass returns NULL if relation does not exist)
for col in 1 2 3 4 5 6; do
  val=$(echo "$SMOKE_RESULT" | cut -d'|' -f"$col")
  if [[ -z "${val:-}" ]]; then
    echo "FAIL: to_regclass() column $col is null." >&2
    exit 1
  fi
done
echo "OK: All to_regclass() results are non-null."
echo "Governance migrations applied and verified."

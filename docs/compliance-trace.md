# Cockpit compliance data path trace

End-to-end trace: UI → API → SQL/RPC/view. Used to confirm roster-scoping and data source determinism.

## 1. Cockpit compliance (canonical) — matrix-v2

| Layer | File | Detail |
|-------|------|--------|
| **UI entry** | `app/app/(cockpit)/cockpit/page.tsx` | Single `useEffect` fetches `/api/compliance/matrix-v2?date=...&shift_code=...` when `sessionOk` **and** `date` and `shiftCode` are set. Response drives both the **Requirements** block (counts, top_requirements) and the **Expiring** tile/panel (expiredCount, expiringCount, top10). No call until date+shift selected. |
| **API route** | `app/api/compliance/matrix-v2/route.ts` | `GET` → requires `date` + `shift_code` (400 SHIFT_CONTEXT_REQUIRED if missing). Roster via `getRosterEmployeeIdsForShift`. Same underlying data as overview-v2: `employees` (roster), `employee_compliance` (roster), `compliance_catalog`, `compliance_requirement_applicability`. Returns `readiness_flag` (LEGAL_NO_GO | LEGAL_WARNING | LEGAL_GO), `kpis`, `by_requirement`, `by_employee`, `expiring_sample`. |
| **SQL / tables** | employees, compliance_catalog, employee_compliance, compliance_requirement_applicability | Roster-scoped employees and assignments; catalog/applicability org-scoped. |
| **Scoping** | **Roster-scoped** | Scope = org_id + site_id + roster_employee_ids for that shift. Single canonical engine; no duplicated logic in cockpit. |

**Debug:** `GET /api/compliance/matrix-v2?date=YYYY-MM-DD&shift_code=Day&debug=1` returns `_debug` with `source`, `scope_inputs` (roster_employee_ids_count), `catalog_count`, `compliance_rows_count`.

### Endpoints no longer used by cockpit (kept for bake time)

| Endpoint | Note |
|----------|------|
| `/api/cockpit/requirements-summary-v2` | Cockpit now uses matrix-v2 for requirement counts; route unchanged. |
| `/api/compliance/overview-v2` | Cockpit now uses matrix-v2 for expiring/legal stoppers; route unchanged. |
| `/api/cockpit/requirements-summary` | Legacy org-wide; `_debug.mode: "legacy"`. |
| `/api/compliance/overview` | Legacy org-wide; `_debug.mode: "legacy"`. |

---

## 3. Shift legitimacy (cockpit summary, date+shift)

| Layer | File | Detail |
|-------|------|--------|
| **UI entry** | Cockpit uses `/api/cockpit/summary` when date + shift are selected (shift legitimacy, issue counts). | Triggered from cockpit summary/issue flow with `date`, `shift_code`, optional `line`. |
| **API route** | `app/api/cockpit/summary/route.ts` | Uses `v_cockpit_station_summary` (via `fetchCockpitIssues`) and for roster-scoped legitimacy calls `evaluateEmployeeComplianceV2` per employee from roster. |
| **SQL / lib** | View `v_cockpit_station_summary`; lib `lib/server/compliance/evaluateEmployeeComplianceV2` | View is roster/date/shift-based. Compliance evaluation is per-employee (roster-scoped). |
| **Scoping** | **Roster-scoped** | Employee list comes from roster for the selected date/shift; compliance and legitimacy are computed for that set. |

**Debug:** `GET /api/cockpit/summary?date=...&shift_code=...&debug=1` (or `_debug=1` in this route) returns `_debug` with data source and scope (see existing implementation in route).

---

## Objects not used by cockpit compliance UI

- `get_compliance_matrix_aggregated` — not referenced in app/lib.
- `calculate_compliance_station_shift_v2` — used only inside `calculate_industrial_readiness_v2` (migration), not by cockpit API routes.
- `v_employee_compliance_blockers_pilot` — not referenced in app/lib.
- `v_employee_compliance_status` — not used by current cockpit compliance endpoints (cockpit uses `v_employee_requirement_status` and tables above).
- `v_active_compliance_requirements` — catalog view; used by HR catalog/requirements flows, not by cockpit compliance summary/overview.

---

## Summary

| Endpoint | Source | Used by cockpit |
|----------|--------|-----------------|
| `/api/cockpit/readiness-v3` | Composes compliance matrix-v2 + competence matrix-v2 (parallel fetch) | **Yes** (canonical; overall status on Readiness tile + Industrial Readiness card) |
| `/api/cockpit/iri-v1` | readiness-v3 → IRI_V1 score/grade (deterministic) | Backend; Industrial Readiness Index™ v1 |
| `/api/compliance/matrix-v2` | tables: employees, compliance_catalog, employee_compliance, compliance_requirement_applicability (roster-filtered) | **Yes** (Requirements + Expiring; also fed into readiness-v3) |
| `/api/competence/matrix-v2` | stations, station_skill_requirements, employee_skills (roster-filtered) | **Yes** (fed into readiness-v3; cockpit overall status from v3) |
| `/api/cockpit/requirements-summary-v2` | view: v_employee_requirement_status (filtered by roster) | No (kept; bake time) |
| `/api/cockpit/requirements-summary` | rpc:get_requirements_summary_v1 | No (legacy) |
| `/api/compliance/overview-v2` | same tables as matrix-v2, roster-filtered | No (kept; bake time) |
| `/api/compliance/overview` | same tables, org-wide | No (legacy) |
| `/api/cockpit/summary` | view: v_cockpit_station_summary + lib evaluateEmployeeComplianceV2 | Yes (shift legitimacy) |

---

## Readiness Unification

Cockpit **overall readiness** (the status shown on the Readiness tile and Industrial Readiness card) is derived **exclusively** from `/api/cockpit/readiness-v3` **`overall.status`**.

- **Source of truth:** `readiness-v3` composes Legal (compliance matrix-v2) + Ops (competence matrix-v2) deterministically. `overall.status` = **NO_GO** if legal NO_GO or ops NO_GO; **WARNING** if either WARNING; else **GO**. Reason codes: LEGAL_BLOCKING, LEGAL_EXPIRING, OPS_NO_COVERAGE, OPS_RISK.
- **UI:** Readiness KpiTile and Industrial Readiness card (when date+shift selected) use `readiness-v3.overall.status` only. When date/shift not selected, the tile falls back to legal-only from matrix-v2 or "—".
- **Legal-only** (Requirements block, Expiring panel) still uses `/api/compliance/matrix-v2` **`readiness_flag`**; that fetch is unchanged. No local logic derives the overall state — it comes from readiness-v3.

---

## Cockpit readiness v3 (overall Legal + Ops)

Single canonical endpoint for **overall** shift readiness. Composes the two engines; no duplicate logic.

| Layer | File | Detail |
|-------|------|--------|
| **UI entry** | `app/app/(cockpit)/cockpit/page.tsx` | When `date` and `shiftCode` are set, fetches `/api/cockpit/readiness-v3?date=...&shift_code=...`. Response drives **overall status** on the Readiness tile and Industrial Readiness card (shift readiness label). |
| **API route** | `app/api/cockpit/readiness-v3/route.ts` | `GET` → requires `date` + `shift_code` (400 SHIFT_CONTEXT_REQUIRED if missing). Fetches in parallel: `/api/compliance/matrix-v2`, `/api/competence/matrix-v2` (same cookies). Returns `legal`, `ops`, `overall` (status, reason_codes), `samples` (legal_blockers, ops_no_go_stations), optional `_debug`. |
| **Composition** | `lib/server/readiness/composeReadinessV3.ts` | Deterministic: `composeOverallStatus(legal, ops)`, `composeReasonCodes(legal, ops)`. NO_GO if either NO_GO; WARNING if either WARNING; else GO. |
| **Scoping** | **Roster-scoped** | Same org_id/site_id and roster as the two matrix-v2 engines (via forwarded cookies). |

**Debug:** `GET /api/cockpit/readiness-v3?date=YYYY-MM-DD&shift_code=Day&debug=1` returns `_debug` with `roster_employee_ids_count`, `sources`, and the two underlying `_debug` blocks (compliance, competence).

---

## IRI_V1 (Industrial Readiness Index™ v1)

Deterministic backend score and grade derived from readiness-v3 (Legal + Ops). Same org/site/date/shift scope.

| Layer | File | Detail |
|-------|------|--------|
| **API route** | `app/api/cockpit/iri-v1/route.ts` | `GET` → requires `date` + `shift_code` (400 SHIFT_CONTEXT_REQUIRED if missing). Fetches readiness-v3 internally (same cookies). Returns `iri_score`, `iri_grade` (A–F), `breakdown` (base_score, deductions), `legal_flag`, `ops_flag`, `overall_status_from_v3`. |
| **Logic** | `lib/server/readiness/iriV1.ts` | **Hard stop:** if `legal.flag === LEGAL_NO_GO` or `ops.flag === OPS_NO_GO` → score = 0. **Else:** score = 100 − (20×blocking_count + 5×non_blocking_count + 15×stations_no_go + 5×stations_warning), min 0. **Grade:** ≥90 A, ≥75 B, ≥60 C, ≥40 D, >0 E, 0 F. |
| **Input** | readiness-v3 | Legal/ops flags and kpis only; no direct DB. |

**Debug:** `GET /api/cockpit/iri-v1?date=...&shift_code=...&debug=1` returns `_debug.readiness_v3_debug` (full readiness-v3 _debug).

---

## Execution-bound freeze

When an **execution decision** is created for a shift-context target with a canonical decision type (RESOLVED, OVERRIDDEN, ACKNOWLEDGED, DEFERRED), a readiness snapshot is created or reused and linked to the decision.

| Layer | File | Detail |
|-------|------|--------|
| **DB** | `execution_decisions.readiness_snapshot_id` | FK to `readiness_snapshots(id)` ON DELETE SET NULL. Index on `readiness_snapshot_id`. |
| **Decision endpoint** | `app/api/cockpit/issues/decision/route.ts` | POST: when shift context (date + shift_code) and decision_type ∈ { RESOLVED, OVERRIDDEN, ACKNOWLEDGED, DEFERRED }, calls `createOrReuseReadinessSnapshot` (same 1‑min duplicate rule), then sets `readiness_snapshot_id` on insert/update. On update, preserves existing `readiness_snapshot_id` if already set (COALESCE). Response includes `readiness_snapshot_id`; with `debug=1`, `_debug.snapshot_created` and `_debug.snapshot_duplicate`. |
| **Shared freeze logic** | `lib/server/readiness/freezeReadinessSnapshot.ts` | Fetches readiness-v3 + iri-v1, 1‑min duplicate window; on new insert calls `get_next_readiness_snapshot_chain_head(org_id)`, computes payload hash in Node (canonical V2, `snapshotPayloadHash.ts`), then RPC `insert_readiness_snapshot_chained` with `p_payload_hash`, `p_chain_position`, `p_previous_hash`. Hash is single source of truth in app; DB stores it. Used by POST /api/cockpit/readiness-freeze and decision route. |

Snapshot content: readiness-v3 (legal/ops flags, overall status, reason_codes, samples) + IRI_V1 (score, grade) at decision time. **Self-contained v2 payload** (migration `20260228220000_readiness_snapshots_v2_payload.sql`): `overall_reason_codes`, `legal_blockers_sample`, `ops_no_go_stations_sample`, `engines`. **Integrity hash** (migration `20260228230000_readiness_snapshots_integrity_hash.sql`): `payload_hash`, `payload_hash_algo`. **Hash algorithm versioning:** `SHA256_V1` = legacy, pre-chain (canonical WITHOUT `previous_hash` or `chain_position`); `SHA256_V2` = chain-aware (canonical WITH those fields). New snapshots use `SHA256_V2`; freeze passes `HASH_ALGO_V2`. Verify is algorithm-aware: it reads `payload_hash_algo` and uses the matching canonical builder (V1 or V2); if algo is null/empty, defaults to V1 so legacy rows still verify. **Ledger (append-only hash-chain)** (migrations `20260301010000_readiness_snapshots_hash_chain.sql`, `20260301020000_readiness_snapshots_chain_insert_rpc.sql`): table is immutable (no UPDATE/DELETE); new rows set `chain_position` = (max per org) + 1 and `previous_hash` = last snapshot’s `payload_hash`. Insert is concurrency-safe via `pg_advisory_xact_lock(hashtext(org_id::text))`. Canonical payload for hashing includes `previous_hash` and `chain_position` (between shift_code and legal_flag) so the hash commits the chain. Non–shift decisions do not create or link a snapshot.

**Exposure and drilldown:**

- **Decision responses:** POST create and list/read endpoints include `readiness_snapshot_id` when set (e.g. `GET /api/cockpit/decisions`, `POST /api/cockpit/issues/decision`).
- **Snapshot drilldown:** `GET /api/readiness/snapshots/[id]` — org-member auth; returns the snapshot row for the active org (404 if not found or wrong org). Response includes `snapshot.overall_reason_codes`, `snapshot.legal_blockers_sample`, `snapshot.ops_no_go_stations_sample`, `snapshot.engines`, and when present `snapshot.payload_hash`, `snapshot.payload_hash_algo`, `snapshot.previous_hash`, `snapshot.chain_position`. `?debug=1` adds `_debug: { org_id, site_id }`.
- **Integrity verify:** `GET /api/readiness/snapshots/[id]/verify` — same auth; reads `payload_hash_algo` from DB and recomputes hash using the matching canonical (V1 or V2). Returns `{ ok, snapshot_id, stored_hash, computed_hash, match, algo }`; if stored hash is null, `match: false`, `reason: "MISSING_HASH"`. Algorithm-aware: V1 canonical omits chain fields; V2 includes `previous_hash` and `chain_position`. See `lib/server/readiness/snapshotPayloadHash.ts`.
- **Audit:** When viewing a focused governance event that is a cockpit decision, the audit event API enriches `meta.readiness_snapshot_id` from `execution_decisions`. The admin audit page shows a “Readiness Snapshot” section with the id, a “View snapshot” action, and when loaded: Engines line, reason_codes, sample counts, integrity hash (when present), and full JSON payload.

---

## Ledger Attestation

**Asymmetric (Ed25519) signed** attestation of the readiness ledger head after full chain verification. Used to prove that the org's snapshot chain was valid at a point in time. Anyone with the **public key** can verify the signature offline without access to the server or any secret.

| Layer | File | Detail |
|-------|------|--------|
| **API route** | `app/api/readiness/ledger/attest/route.ts` | `GET` — same auth as ledger verify (active org from session). Runs full chain verification (shared logic in `lib/server/readiness/verifyLedgerChain.ts`). If `chain_valid !== true` returns `{ ok: false, error: "LEDGER_NOT_VALID" }`. If valid, fetches latest snapshot (by `chain_position` DESC, `created_at` DESC), builds deterministic payload `{ org_id, head_position, head_hash, total_snapshots, verified_at }`, signs with **Ed25519** using `LEDGER_ED25519_PRIVATE_KEY`, returns `{ ok: true, attestation: { ...payload, signature_algo: "ED25519_V1", signature, public_key } }`. |
| **Shared verification** | `lib/server/readiness/verifyLedgerChain.ts` | Pure function `verifyLedgerChain(rows)`: hash check per row + V2 chain linkage. Used by both `GET /api/readiness/ledger/verify` and `GET /api/readiness/ledger/attest`. |
| **Keys** | `LEDGER_ED25519_PRIVATE_KEY`, `LEDGER_ED25519_PUBLIC_KEY` (env) | **Required:** both base64-encoded raw keys. If private key is missing, the route throws `LEDGER_ED25519_PRIVATE_KEY not set`. Not committed to the repo. |

**Asymmetric signing:** The attestation payload is deterministic. The server signs `JSON.stringify(payload)` with the Ed25519 private key. The response includes `public_key` (base64) and `signature` (base64). **Public key verification:** Any verifier can use the included (or separately distributed) public key to run `crypto.verify(null, payloadBuffer, publicKeyBuffer, signatureBuffer)` and confirm the payload was signed by the holder of the private key and was not altered. **Offline verification:** Verification does not require calling the API or holding a secret; only the public key and the attestation JSON are needed. **HMAC deprecated:** The previous HMAC-SHA256 flow using `LEDGER_ATTESTATION_SECRET` is no longer used; code is retained commented for reference. **Key rotation:** To rotate, generate a new Ed25519 key pair, set the new env vars, and deploy. Old attestations remain verifiable with the old public key (distribute or store it if long-term verification is needed); new attestations will use the new key and include the new `public_key` in the response.

---

## Competence trace (Matrix v2 — operational readiness)

Roster-scoped competence engine for **operational** readiness (stations × mandatory skills × roster employees). Deterministic; audit-friendly breakdowns.

| Layer | File | Detail |
|-------|------|--------|
| **API route** | `app/api/competence/matrix-v2/route.ts` | `GET` → requires `date` + `shift_code` (400 SHIFT_CONTEXT_REQUIRED if missing). Roster via `getRosterEmployeeIdsForShift`. Data: `stations`, `station_skill_requirements` (MANDATORY only), `skills`, `employee_skills`. Returns `ops_readiness_flag` (OPS_GO \| OPS_WARNING \| OPS_NO_GO), `kpis`, `by_station`, `by_employee`. |
| **Shared logic** | `lib/server/competence/stationReadiness.ts` | Pure functions: `buildStationRequirements`, `buildEmployeeLevels`, `computeStationReadiness`, `shiftOpsReadinessFromStations`. Eligibility: employee level ≥ required_level for every mandatory skill; station OPS_NO_GO if 0 eligible, else OPS_GO. |
| **SQL / tables** | stations, station_skill_requirements, skills, employee_skills | Org-scoped stations and requirements; roster-scoped employee skills. MANDATORY = `is_mandatory !== false`. |
| **Scoping** | **Roster-scoped** | Scope = org_id + site_id + roster_employee_ids for the shift. Single canonical engine; cockpit not updated in this phase (engine first). |

**Debug:** `GET /api/competence/matrix-v2?date=YYYY-MM-DD&shift_code=Day&debug=1` returns `_debug` with `org_id`, `site_id`, `date`, `shift_code`, `roster_employee_ids_count`, `stations_queried`, `requirements_rows`, `ratings_rows`.

**Empty roster:** Returns `ok: true`, `ops_readiness_flag: "OPS_NO_GO"`, kpis zeros, empty arrays (operationally cannot run a shift with no staff).

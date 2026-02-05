# P1.6.2 "Site: unknown" diagnostic findings

## 1. Files and line numbers where "Unknown site" is rendered

| File | Line | Data source |
|------|------|-------------|
| `app/app/compliance/page.tsx` | 358 | `data?.activeSiteId`, `data?.activeSiteName` from `GET /api/compliance/overview` |
| `app/app/compliance/actions/page.tsx` | 368 | `data?.activeSiteId`, `data?.activeSiteName` from `GET /api/compliance/actions/inbox` |
| `app/app/compliance/summary/page.tsx` | 323 | `data?.context?.activeSiteId`, `data?.context?.activeSiteName` from summary API |
| `app/app/compliance/matrix/page.tsx` | 230 | `data?.activeSiteId`, `data?.activeSiteName` from `GET /api/compliance/matrix` |
| `app/app/hr/templates/compliance-actions/page.tsx` | 195 | `data?.activeSiteId`, `data?.activeSiteName` from `GET /api/hr/templates/compliance-actions/list` |
| `components/compliance/ComplianceDrawer.tsx` | 883 | Props `activeSiteId`, `activeSiteName` (passed by parent page) |

API routes that use "Unknown site" as fallback string (for export/labels only, not the chip):
- `app/api/compliance/actions/export/route.ts` (274, 280, 306)
- `app/api/compliance/actions/inbox/route.ts` (274) — per-row `site_name`, not the chip payload

## 2. Call chain (Compliance Overview as example)

- **Component:** `app/app/compliance/page.tsx` — renders Badge with `data?.activeSiteName ?? "Unknown site"`.
- **Data:** `data` from `useState<OverviewResponse | null>`, set by `fetch('/api/compliance/overview')` in `loadOverview`.
- **API route:** `GET /api/compliance/overview` → `app/api/compliance/overview/route.ts`.
- **Org/site resolution:** `getActiveOrgFromSession(request, supabase)` → reads `profiles.active_org_id` and `profiles.active_site_id` from DB.
- **Site name:** `getActiveSiteName(supabaseAdmin, org.activeSiteId, orgId)` in `lib/server/siteName.ts` → queries `org_units` by `id` (+ `org_id`); single-site fallback if one org_unit; else returns `null`.
- **Response:** API returns `activeSiteId: org.activeSiteId ?? null`, `activeSiteName` (result of `getActiveSiteName` or `null`). UI shows "Unknown site" when `activeSiteId` is set but `activeSiteName` is null.

Same pattern for: **actions inbox** (`/api/compliance/actions/inbox`), **summary** (`/api/compliance/summary`), **matrix** (`/api/compliance/matrix`), **HR templates list** (`/api/hr/templates/compliance-actions/list`). All use `getActiveOrgFromSession` for `activeSiteId` and `getActiveSiteName` for `activeSiteName`.

## 3. Context fields that can be null/undefined at runtime

- **`profile.active_site_id`** — Set by client (e.g. site switcher) and persisted to `profiles`. If never set or cleared, `org.activeSiteId` is null → chip shows "All", not "Unknown site".
- **"Unknown site" appears when:** `profile.active_site_id` is set (non-null) but `getActiveSiteName(supabase, activeSiteId, orgId)` returns null. That happens when:
  - The site UUID is not in `org_units` for this org, or
  - `org_units` has no row with that `id` + `org_id`, and the org does not have exactly one org_unit (so single-site fallback does not apply).

So the root cause is **missing or inconsistent site context**: either `profiles.active_site_id` points to a non-existent or wrong org_unit, or the org has 0 or 2+ org_units and the ID doesn’t match any row.

## 4. Diagnostic added

- **File:** `app/app/compliance/page.tsx`
- **Change:** A `useEffect` that runs when `data` (and `currentOrg?.id`) is available and logs to the console:
  - `active_org_id` (from `currentOrg?.id`; client-side org from useOrg)
  - `active_site_id` (from `data.activeSiteId`; API response from overview)
  - `resolved_site_name` (from `data.activeSiteName`; API response)
  - `source`: `"API response from GET /api/compliance/overview"`

This confirms at runtime which of these are null when the user sees "Unknown site".

## 5. Proposed minimal fix plan (do not implement yet)

**Single source of truth:** Ensure `active_site_id` on the profile always refers to an existing `org_units.id` for the current `active_org_id`, and that `getActiveSiteName` is called with the same org scope. Options: (1) When setting `active_site_id` (e.g. site switcher), validate that the site belongs to the current org and exists in `org_units` before persisting. (2) In `getActiveSiteName`, if the primary lookup fails, optionally resolve via `employees.site_id` or org membership so a valid name is returned for the same tenant. (3) In API routes that return the chip payload, if `getActiveSiteName` returns null but `activeSiteId` is set, re-fetch or derive the name from the same org (e.g. single org_unit fallback is already there; ensure `org_units` is populated and that `active_site_id` is not an old/stale UUID from another org). Prefer fixing the data flow so the profile’s `active_site_id` is always a valid org_unit id for the active org; then the existing `getActiveSiteName` + single-site fallback should suffice and the chip will show the name instead of "Unknown site".

## 6. Exact file/lines to change for the fix (when implementing)

- **UI (display):** No change to the fallback string `"Unknown site"` is required; keep it for when the name truly cannot be resolved.
- **Server (root cause):** Prefer one or more of:
  - **`lib/server/activeOrg.ts`** — No change required for return shape; ensure callers only ever get a site id that is valid for the org (e.g. validation when profile is updated).
  - **`lib/server/siteName.ts`** — Optionally extend fallback (e.g. by `employees.site_id` or org_units list) so that a valid name is returned when the org has the site in use; document when "Unknown site" is still intended.
  - **Site switcher / profile update path** — Ensure whenever `active_site_id` is set, it is validated against `org_units` for the current `active_org_id` (e.g. in `api/me/active-org` or a dedicated `api/me/active-site` or equivalent). If the ID is invalid or from another org, clear it or set to a valid org_unit id.
- **APIs** — No change required to response shape; they already return `activeSiteId` and `activeSiteName`; fixing the data source and `getActiveSiteName` behavior will fix the chip.

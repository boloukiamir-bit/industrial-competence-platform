# Curl Auth for API Routes

API routes use Supabase SSR auth via cookies. For curl, pass the auth cookie from your browser session.

## 1. Get the auth cookie from browser

1. Log in to the app in your browser (e.g. http://localhost:5001).
2. Open DevTools → Application (Chrome) or Storage (Firefox) → Cookies.
3. Find `sb-<project-ref>-auth-token` (and optionally `sb-<project-ref>-auth-token.0`, `.1` if chunked).
4. Copy the full `name=value` for the auth cookie(s).

Project ref comes from `NEXT_PUBLIC_SUPABASE_URL`, e.g. `https://bmvawfrnlpdvcmffqrzc.supabase.co` → ref is `bmvawfrnlpdvcmffqrzc`.

**Expected cookie name:** `sb-bmvawfrnlpdvcmffqrzc-auth-token` (or `sb-<your-ref>-auth-token`).

## 2. Diagnostic: whoami

Verify cookies and auth before calling other endpoints:

```bash
# Replace COOKIE_VALUE with the actual cookie value from browser
curl -s "http://localhost:5001/api/auth/whoami" \
  -H "Cookie: sb-bmvawfrnlpdvcmffqrzc-auth-token=COOKIE_VALUE"
```

If chunked, include all chunks (the value may be in multiple cookies):

```bash
curl -s "http://localhost:5001/api/auth/whoami" \
  -H "Cookie: sb-bmvawfrnlpdvcmffqrzc-auth-token=CHUNK0; sb-bmvawfrnlpdvcmffqrzc-auth-token.0=CHUNK1; sb-bmvawfrnlpdvcmffqrzc-auth-token.1=CHUNK2"
```

**Success response:**
```json
{
  "authenticated": true,
  "user": { "id": "...", "email": "user@example.com" },
  "cookies_present": ["sb-bmvawfrnlpdvcmffqrzc-auth-token"],
  "expected_auth_cookie": "sb-bmvawfrnlpdvcmffqrzc-auth-token",
  "has_auth_cookie": true
}
```

**Failure (no/invalid cookie):**
```json
{
  "authenticated": false,
  "cookies_present": [],
  "expected_auth_cookie": "sb-bmvawfrnlpdvcmffqrzc-auth-token",
  "has_auth_cookie": false,
  "error": "Invalid or expired session"
}
```

## 3. Cockpit summary and issues

Once whoami returns `authenticated: true`, use the same Cookie header:

```bash
# Summary
curl -s "http://localhost:5001/api/cockpit/summary?date=2026-01-30&shift_code=Day" \
  -H "Cookie: sb-bmvawfrnlpdvcmffqrzc-auth-token=COOKIE_VALUE"

# Issues (with debug)
curl -s "http://localhost:5001/api/cockpit/issues?date=2026-01-30&shift_code=Day&debug=1" \
  -H "Cookie: sb-bmvawfrnlpdvcmffqrzc-auth-token=COOKIE_VALUE"
```

## 4. Using COOKIES env var (scripts)

```bash
export COOKIES="sb-bmvawfrnlpdvcmffqrzc-auth-token=YOUR_VALUE_HERE"

# whoami
curl -s "http://localhost:5001/api/auth/whoami" -H "Cookie: $COOKIES" | jq .

# Cockpit reconciliation
COOKIES="$COOKIES" DATE=2026-01-30 SHIFT=Day ./scripts/curl-cockpit-reconciliation.sh
```

## 5. Cockpit site fix – proof (debug=1)

After the active-site resolution fix, summary and issues must show a resolved `site_id` and non-zero counts when the DB has rows for that org/site/shift.

**Exact curl commands (use your auth cookie):**

```bash
# 1) whoami
curl -s "http://localhost:5001/api/auth/whoami" -H "Cookie: sb-bmvawfrnlpdvcmffqrzc-auth-token=COOKIE_VALUE"

# 2) Summary with debug (must show site_id and raw counts > 0)
curl -s "http://localhost:5001/api/cockpit/summary?date=2026-01-30&shift_code=Day&debug=1" \
  -H "Cookie: sb-bmvawfrnlpdvcmffqrzc-auth-token=COOKIE_VALUE"

# 3) Issues (must return non-empty issues array)
curl -s "http://localhost:5001/api/cockpit/issues?date=2026-01-30&shift_code=Day" \
  -H "Cookie: sb-bmvawfrnlpdvcmffqrzc-auth-token=COOKIE_VALUE"
```

**Expected after fix:**

- **whoami:** `"authenticated": true`
- **summary** (with `debug=1`): `_debug` must include:
  - `site_id`: `"2d3f16a8-dc34-4c66-8f7c-2481a84bffba"` (or your org’s default site id)
  - `site_filter_mode`: `"orNull"`
  - `raw_count_before_status` > 0
  - `raw_count_after_status` > 0
- **issues:** `ok: true`, `issues` array length > 0

Reconciliation script with debug:

```bash
DATE=2026-01-30 SHIFT=Day DEBUG=1 COOKIES="sb-...-auth-token=YOUR_VALUE" ./scripts/curl-cockpit-reconciliation.sh
```

## 6. Cockpit drilldown proof

```bash
# Auth: browser cookie or .dev-cockpit-cookies (dev-only)
export COOKIES="sb-<ref>-auth-token=YOUR_VALUE"
# Optional: save for reuse
echo "$COOKIES" > .dev-cockpit-cookies

./scripts/prove-cockpit-drilldown.sh
```

**PASS:** `headcount>0` and `blockers+warnings>0` for the drilled station (prefers NO_GO issue).  
**Auth path:** DevTools → Application → Cookies → copy `sb-*-auth-token`. Fallback: `COOKIES` from env or `.dev-cockpit-cookies` (dev-only; never commit).

## 7. Cookie handling (server)

- `createSupabaseServerClient(request)` uses `request.cookies` when `request` is passed.
- Cockpit routes pass `request` so the Cookie header from curl is used.
- Supabase SSR expects `getAll` and `setAll`; both are wired in `lib/supabase/server.ts`.
- Token refresh: if the access token is expired, Supabase will refresh using the refresh token (inside the auth-token cookie). New cookies are collected in `pendingCookies` and applied via `applySupabaseCookies(response, pendingCookies)`.

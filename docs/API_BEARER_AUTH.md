# API auth with Bearer token

API routes that use `getOrgIdFromSession` / `getActiveOrgFromSession` accept **session cookies** (browser) or **Bearer token** (curl/scripts).

## Bearer token format

- Header: `Authorization: Bearer <access_token>`
- `<access_token>` must be the **raw Supabase JWT** (the `access_token` from the session), not a base64-encoded session object.
- No space after `Bearer`, and no leading/trailing spaces in the token.

## Correct curl (raw JWT)

```bash
BASE="http://localhost:5001"
# Use the raw JWT access_token (starts with eyJ...)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."

curl -s -4 -H "Authorization: Bearer $TOKEN" "$BASE/api/line-overview/lines" | jq .
```

- **No space** in `TOKEN="..."` (wrong: `TOKEN ="..."`).
- Token value must be the **JWT string** only (what you get from `session.access_token` in the client or from Supabase Auth).

## If you have a base64-encoded session blob

If your token is `base64-<base64payload>` where the payload decodes to JSON with `access_token` and `refresh_token`:

```bash
# Strip optional "base64-" prefix and leading space, decode, get access_token
TOKEN=$(echo "$TOKEN_RAW" | sed 's/^ *base64-//' | base64 -d 2>/dev/null | jq -r '.access_token // .access_token // empty')
# Then use $TOKEN in curl as above
```

Or in one line (replace YOUR_BASE64_SESSION with your value):

```bash
curl -s -4 -H "Authorization: Bearer $(echo 'YOUR_BASE64_SESSION' | base64 -d | jq -r '.access_token')" "http://localhost:5001/api/line-overview/lines" | jq .
```

## Getting the access token in the browser

In the app (browser console, with an active session):

```js
const { data: { session } } = await window.__supabase?.auth.getSession();
console.log(session?.access_token);
```

Use that string as `TOKEN` in curl.

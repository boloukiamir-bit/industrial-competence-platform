# Bearer Auth Support (CORE APIs)

These endpoints accept either cookies (browser) or `Authorization: Bearer <access_token>`.

## 1) Verify Bearer auth works

```bash
BASE="http://localhost:5001"

curl -s -4 -H "Authorization: Bearer $TOKEN" "$BASE/api/line-overview/lines"
curl -s -4 -H "Authorization: Bearer $TOKEN" "$BASE/api/line-overview?date=2026-01-30&shift=Day"
curl -s -4 -H "Authorization: Bearer $TOKEN" "$BASE/api/org/units"
curl -s -4 -H "Authorization: Bearer $TOKEN" "$BASE/api/tomorrows-gaps?date=2026-01-30&shift=Day"
```

Expected: 200 OK for valid tokens. `/api/org/units` should include `meta.totalEmployeesAfterSiteFilter` that matches the Employees page count.

## 2) Verify invalid token handling

```bash
BASE="http://localhost:5001"
BAD_TOKEN="invalid"

curl -i -s -4 -H "Authorization: Bearer $BAD_TOKEN" "$BASE/api/org/units"
```

Expected: 401 with `{"error":"Invalid or expired session"}`.

# P1.4 Compliance Template Manager Verification

HR can list, edit, and toggle compliance action draft templates at **HR Tools → Compliance Templates**.

## API

- **GET /api/hr/templates/compliance-actions/list** — `{ ok, templates, activeSiteId, activeSiteName }`. Admin/HR.
- **POST /api/hr/templates/compliance-actions/upsert** — Body: `{ id?, scope:'org'|'site', action_type, channel, name, title, body, is_active? }`. scope=site requires activeSiteId.
- **POST /api/hr/templates/compliance-actions/toggle** — Body: `{ id, is_active }`. Admin/HR.

## UI

1. Nav: **Compliance Templates** under HR.
2. Page: site chip, filters (scope/action/channel/search), table of templates.
3. Edit: click row → Sheet with name, title, body, preview (sample vars), Save.
4. Toggle: Enable/Disable per row.

## curl

```bash
curl -s '/api/hr/templates/compliance-actions/list' -H 'Cookie: ...' | jq .
curl -s -X POST '/api/hr/templates/compliance-actions/toggle' \
  -H 'Content-Type: application/json' -H 'Cookie: ...' \
  -d '{"id":"TEMPLATE_ID","is_active":false}' | jq .
```

## Build

`rm -rf .next && npm run build`

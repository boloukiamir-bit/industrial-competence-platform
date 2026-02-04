# P1.5 Draft History + Audit Verification

Copying a draft from DraftModal logs a `draft_copied` event. Inbox and Drawer show "Last drafted" metadata. Site: if activeSiteId set and action belongs to another site, draft-event returns 409.

## API

**POST /api/compliance/actions/[id]/draft-event**  
Body: `{ channel?, template_id?, copied_title, copied_body }`. Any org member.  
409 when activeSiteId set and action.site_id !== activeSiteId.

**GET /api/compliance/actions/inbox** — each row includes `lastDraftedAt`, `lastDraftedBy`, `lastDraftedChannel`, `lastDraftedTemplateId`.

**GET /api/compliance/actions?employeeId=...** — each action includes `last_drafted_at`, `last_drafted_channel`.

## UI

1. Inbox: "Last drafted" column with relative time; tooltip with timestamp and channel.
2. Drawer: under each action, "Last drafted: …" or "Never drafted".
3. DraftModal: after Copy body or Copy title+body, fire-and-forget POST to draft-event when actionId is provided.

## curl

```bash
curl -s -X POST 'http://localhost:3000/api/compliance/actions/ACTION_ID/draft-event' \
  -H 'Content-Type: application/json' -H 'Cookie: ...' \
  -d '{"channel":"email","copied_title":true,"copied_body":true}' | jq .
```

## Build

`rm -rf .next && npm run build`

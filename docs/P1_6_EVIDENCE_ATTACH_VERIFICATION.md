# P1.6 Evidence Attach Verification

HR can attach evidence (URL + notes) to a compliance action. Inbox shows Evidence column; Drawer shows link and Attach/Edit. Audit: evidence on `compliance_actions` + `evidence_added` event.

## API

**POST /api/compliance/actions/[id]/evidence**  
Body: `{ evidence_url, evidence_notes? }`. Admin/HR. URL required, http(s).  
409 when activeSiteId set and action.site_id !== activeSiteId.

**GET /api/compliance/actions/inbox** — rows include `hasEvidence`, `evidenceAddedAt`, `evidenceUrl`, `evidenceNotes`.

**GET /api/compliance/actions?employeeId=...** — actions include `evidence_url`, `evidence_notes`, `evidence_added_at`, `evidence_added_by`.

## UI

1. Inbox: Evidence column — "Attached" (tooltip URL/notes) or "None"; paperclip opens Evidence modal.
2. Drawer: per action, evidence link + timestamp; "Attach" / "Edit" opens Evidence modal.
3. Evidence modal: URL (required), notes (optional), Save. On save, refetch and close.

## curl

```bash
curl -s -X POST 'http://localhost:3000/api/compliance/actions/ACTION_ID/evidence' \
  -H 'Content-Type: application/json' -H 'Cookie: ...' \
  -d '{"evidence_url":"https://example.com/doc.pdf","evidence_notes":"Certificate"}' | jq .
```

## Build

`rm -rf .next && npm run build`

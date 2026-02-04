# P1.3 Template Drafts Verification

Compliance action drafts reuse `hr_templates` (category `compliance_action_draft`). GET returns templates by action type/channel; POST render returns title/body with variables replaced. DraftModal shows draft and Copy body / Copy title+body.

## DB

- No schema change. Migrations `20260204001000` (indexes + seed rows) already applied.
- `hr_templates`: category `compliance_action_draft`, code `compliance_action_draft.<action_type>.<channel>`.

## API

**GET /api/hr/templates/compliance-actions**  
Auth: Admin/HR. Returns `{ ok, templatesByActionType }` with merged org + site templates.

**POST /api/hr/templates/compliance-actions/render**  
Body: `{ actionId, channel }` or `{ employee_id, compliance_code, action_type, due_date?, channel }`.  
Returns `{ ok, title, body, channel, usedTemplateId, variables }`.  
404 `template_missing` when no template for action type/channel.

## UI

1. Action Inbox or ComplianceDrawer: open Draft (file icon).
2. Select channel (email/sms/note), see subject and body.
3. Copy body or Copy title+body. If template missing, toast shows error.

## curl

```bash
# Render by action (replace ACTION_ID)
curl -s -X POST 'http://localhost:3000/api/hr/templates/compliance-actions/render' \
  -H 'Content-Type: application/json' -H 'Cookie: ...' \
  -d '{"actionId":"ACTION_ID","channel":"email"}' | jq .
```

## Build

`rm -rf .next && npm run build`

# P1.7 Notifications Export Pack — Verification

## Overview

HR can export ready-to-send drafts and evidence links as a CSV bundle from the Action Inbox, without sending emails/SMS.

- **API:** `GET /api/compliance/actions/export`
- **UI:** "Export CSV" button on Action Inbox with channel selector (Email / SMS / Note).

---

## API: GET /api/compliance/actions/export

### Auth & scoping

- Admin/HR only (same as inbox). Tenant scoped via `getActiveOrgFromSession`.
- If `activeSiteId` is set in session, only actions where `compliance_actions.site_id = activeSiteId` are included.

### Query parameters

| Param       | Default | Description |
|------------|---------|-------------|
| `status`   | `open`  | `open` \| `done` \| `all` |
| `sla`      | `all`   | `all` \| `overdue` \| `due7d` \| `nodue` |
| `actionType` | `all` | e.g. `request_renewal`, `request_evidence`, … |
| `category` | `all`   | `all` \| `license` \| `medical` \| `contract` |
| `line`     | —       | Filter by employee line |
| `q`        | —       | Search employee name or number |
| `owner`    | `all`   | `all` \| `me` \| `unassigned` |
| `limit`    | `500`   | 1–2000 |
| `channel`  | `email` | `email` \| `sms` \| `note` (draft channel for subject/body) |

### Response

- **Content-Type:** `text/csv; charset=utf-8`
- **Content-Disposition:** `attachment; filename="compliance-actions-export-YYYY-MM-DD.csv"`

### CSV columns

`action_id`, `employee_id`, `employee_number`, `employee_name`, `site_name`, `line`, `compliance_code`, `compliance_name`, `action_type`, `channel`, `due_date`, `owner_email`, `last_drafted_at`, `evidence_url`, `evidence_notes`, `subject`, `body`, `template_status`, `evidence_status`

- **template_status:** `ok` \| `missing` (missing = no template for action_type+channel; subject/body empty).
- **evidence_status:** `attached` \| `none`.

### curl examples

```bash
# Default (open, email, limit 500). Requires session cookie.
curl -b cookies.txt -o export.csv "https://your-app/api/compliance/actions/export"

# With filters
curl -b cookies.txt -o export.csv "https://your-app/api/compliance/actions/export?status=open&sla=overdue&owner=unassigned&channel=email&limit=500"

# SMS drafts
curl -b cookies.txt -o export.csv "https://your-app/api/compliance/actions/export?channel=sms&limit=1000"
```

### Behaviour

- Draft subject/body use the same resolution as the draft modal: site-specific template then org-wide (see `lib/server/complianceDraftRender.ts` and `lib/hrTemplatesCompliance.ts`).
- If no template exists for the action type + channel, the row is still exported with empty `subject`/`body` and `template_status=missing`.
- CSV fields are RFC 4180–escaped (commas, newlines, quotes).

---

## UI check steps

1. **Access**
   - Log in as Admin or HR.
   - Go to **Compliance → Action Inbox** (`/app/compliance/actions`).

2. **Export controls**
   - Next to the quick filters (Overdue, Due <7d, No due date, Unassigned, Mine) you should see:
     - A channel dropdown: **Email** (default), **SMS**, **Note**.
     - An **Export CSV** button.

3. **Download**
   - Set filters (e.g. status, SLA, owner, action type, category, line, search).
   - Choose channel (e.g. Email).
   - Click **Export CSV**.
   - A CSV file should download with the current filter set and chosen channel.
   - Filename format: `compliance-actions-export-YYYY-MM-DD.csv`.

4. **Content**
   - Open the CSV in a spreadsheet or text editor.
   - Confirm headers include: `action_id`, `employee_id`, `employee_number`, `employee_name`, `site_name`, `line`, `compliance_code`, `compliance_name`, `action_type`, `channel`, `due_date`, `owner_email`, `last_drafted_at`, `evidence_url`, `evidence_notes`, `subject`, `body`, `template_status`, `evidence_status`.
   - Rows should match the filtered list; `subject` and `body` should contain the rendered draft for the chosen channel (or be empty with `template_status=missing` when no template exists).

5. **Channel**
   - Change channel to **SMS** or **Note**, export again.
   - Confirm `channel` column and draft content reflect the selected channel (where templates exist).

---

## Tests

- **CSV escaping:** `tests/unit/csvEscape.test.ts` (commas, newlines, quotes).
- **Export route:** `tests/unit/compliance-export.test.ts` (source: tenant scoping via `getActiveOrgFromSession` and `org_id`; `template_status` and `renderDraftForAction` usage).
- **Draft render:** `tests/unit/complianceDraftRender.test.ts` (when no template, `renderDraftForAction` returns `template_status=missing`).

Run: `npm test --silent`

---

## Implementation notes

- **Reuse:** Export uses `getActiveOrgFromSession`, same filter logic as inbox, `renderDraftForAction` (same template resolution as the draft modal), `escapeCsvField` for CSV, and `buildCode`/`parseTemplate` from `lib/hrTemplatesCompliance.ts`.
- **No extra endpoints:** Only `GET /api/compliance/actions/export` added.
- **No new dependencies:** Uses existing Next.js, Supabase, and UI components.

# Competencies Import – Verification

Production-grade import pipeline for **skills** and **employee skill ratings**, tenant-scoped by session (`active_org_id` + `active_site_id`).

## Schema

- **`public.skills`**: `id`, `org_id`, `code`, `name`, `category` (nullable), `description` (nullable).  
  Unique per org: `UNIQUE (org_id, code)`.
- **`public.employee_skills`**: `employee_id`, `skill_id`, `level` (0–4).  
  Uniqueness: `UNIQUE (employee_id, skill_id)`. Org inferred via employee/skill joins.

## Sample CSV Rows

### 1. Skills (`skills.csv`)

Columns: **`code`**, **`name`**; optional: **`category`**, **`description`**.

```csv
code,name,category,description
PRESS_A,Pressline A,Production,Operate press line A
PRESS_B,Pressline B,Production,Operate press line B
5S,5S Basics,Lean,5S methodology basics
SAFETY_BASIC,Safety Basic,Safety,Basic safety training
TRUCK_A1,Truck A1 License,Logistics,Forklift A1 license
```

Sample file: `attached_assets/competencies_import_sample_skills.csv`.

### 2. Employee skills (`employee_skills.csv`)

Columns: **`employee_number`**, **`skill_code`**, **`level`** (0–4).

```csv
employee_number,skill_code,level
E1001,PRESS_A,3
E1001,PRESS_B,2
E1001,5S,4
E1002,PRESS_A,2
E1002,SAFETY_BASIC,2
E1002,TRUCK_A1,0
```

Sample file: `attached_assets/competencies_import_sample_employee_skills.csv`.

- `employee_number` must match `employees.employee_number` for the active org.
- `skill_code` must match `skills.code` for the active org. **Import skills first.**

## curl Examples

Replace `<BASE_URL>` with your app origin (e.g. `http://localhost:3000`) and use the same auth cookie or `Authorization: Bearer <access_token>` for all calls. **Org is always taken from the session** (`getActiveOrgFromSession`); never send `org_id` from the client.

### Skills import

**Multipart form (file):**

```bash
curl -X POST "<BASE_URL>/api/competencies/import/skills" \
  -H "Cookie: sb-<project>-auth-token=<session>" \
  -F "file=@attached_assets/competencies_import_sample_skills.csv"
```

**JSON body (CSV string):**  
Send `{"csv": "<raw csv string>"}`. Use a file or escape newlines as `\n` in the JSON.

**Response (success):**  
`{ "summary": { "inserted": 0, "updated": 5, "skipped": 0, "errors": 0 } }`

### Employee-skills import

**Multipart form (file):**

```bash
curl -X POST "<BASE_URL>/api/competencies/import/employee-skills" \
  -H "Cookie: sb-<project>-auth-token=<session>" \
  -F "file=@attached_assets/competencies_import_sample_employee_skills.csv"
```

**Text/CSV body:**

```bash
curl -X POST "<BASE_URL>/api/competencies/import/employee-skills" \
  -H "Content-Type: text/csv" \
  -H "Cookie: sb-<project>-auth-token=<session>" \
  --data-binary "@attached_assets/competencies_import_sample_employee_skills.csv"
```

**Response (success):**  
`{ "summary": { "inserted": 0, "updated": 20, "skipped": { "unknownEmployee": 0, "unknownSkill": 0, "invalid": 0 } }, "skippedRows": { "unknownEmployee": [], "unknownSkill": [] } }`

Skipped rows (unknown `employee_number` or `skill_code`) are included in `skippedRows` (capped); the UI can offer a “Download skipped rows” CSV.

## Run-through

1. **Ensure session has `active_org_id`** (e.g. set via org switcher or `POST /api/me/active-org`).
2. **Import employees** for that org first (e.g. via `/app/import-employees`) so `employee_number` values exist.
3. **Import skills:**  
   `POST /api/competencies/import/skills` with `skills.csv` (or use the UI at `/app/import-competencies`).
4. **Import employee skills:**  
   `POST /api/competencies/import/employee-skills` with `employee_skills.csv`.
5. **Open Competence Matrix** (`/app/competence-matrix`). It loads skills and employee skill levels from `getEmployeesWithSkills` (tenant-scoped). You should see skill columns and levels.

## UI

- **Page:** `/app/import-competencies`.
- Two upload sections: (1) Skills CSV, (2) Employee skills CSV.
- Each shows a result summary (updated, skipped, errors).  
- Optional: “Download skipped (unknown employee) CSV” / “Download skipped (unknown skill) CSV” when there are skipped rows.

The **“Import competencies”** button on the Competence Matrix links to `/app/import-competencies`.

## Scale

- Batch upserts (e.g. 100 rows per batch) and stream-style CSV parsing (Papa) keep imports fast.
- Tested for ~89 employees and hundreds of ratings without timeouts.

## DB Migration

- `supabase/migrations/20260129210000_competencies_import_constraints.sql`:
  - `skills.description` added if missing.
  - `UNIQUE (org_id, code)` on `skills` (index already existed; `skills_name_key` dropped so name can repeat across orgs).
  - `UNIQUE (employee_id, skill_id)` on `employee_skills` ensured.

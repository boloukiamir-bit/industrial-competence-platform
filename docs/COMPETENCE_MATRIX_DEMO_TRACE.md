# Competence Matrix – Demo / Hardcoded Sources Trace

## Goal
Competence Matrix must be 100% tenant-DB-driven from `public.skills` (catalog) and `public.employee_skills` (ratings). No demo skills (PRESS_A/B, 5S, SAFETY_BASIC, TRUCK_A1) from constants or seed.

---

## 1) Where demo skills are injected

### A) **services/competenceService.ts**
- **Lines 11–17**: `demoSkills` – hardcoded list (PRESS_A, PRESS_B, 5S, SAFETY_BASIC, TRUCK_A1).
- **Lines 19–25**: `demoSkillLevels` – hardcoded employee→skill ratings (E1001–E1004).
- **Lines 30–124**: `seedDemoDataIfEmpty(orgId)` – when `NEXT_PUBLIC_DEMO_MODE=true` and active org is `NEXT_PUBLIC_DEMO_ORG_ID`, inserts demo employees into `employees`, demo skills into `skills`, and demo ratings into `employee_skills`.

**Offending code (excerpt):**
```ts
const demoSkills: Omit<Skill, "id">[] = [
  { code: "PRESS_A", name: "Pressline A", category: "Production" },
  ...
];
// ...
export async function seedDemoDataIfEmpty(orgId?: string | null): Promise<void> {
  // ... inserts into employees, skills, employee_skills
}
```

### B) **app/app/competence-matrix/page.tsx**
- **Lines 45–47**: When `demoMode` is true, calls `await seedDemoDataIfEmpty(activeOrgId)` before loading data. This injects demo skills into the DB so the matrix shows them.

**Offending code:**
```ts
if (demoMode) {
  await seedDemoDataIfEmpty(activeOrgId);
}
```

### C) **lib/demoData.ts**
- **Lines 67–79**: `DEMO_SKILLS_DATA` / `DEMO_SKILLS` – static list including PRESS_A, PRESS_B, SAFETY_BASIC, TRUCK_A1 (and others). Used by debug page and demo runtime, not by competence matrix data path. Matrix is affected only indirectly if seed data is aligned with these codes.

### D) **app/api/debug/competence-provenance/route.ts**
- **Line 9**: `DEMO_CODES = ["PRESS_A", "PRESS_B", "5S", "SAFETY_BASIC", "TRUCK_A1"]` – used only for debug/provenance labelling, not for matrix display.

### E) **scripts/cleanup-demo-employee-skills.ts**
- **Line 5**: Same `DEMO_CODES` – used for cleanup script only.

### F) **getEmployeesWithSkills** (competenceService.ts)
- **Current behaviour**: Skills are derived only from `employee_skills` join (skills that have at least one rating). So the matrix shows only “skills that have ratings”, not the full org catalog. To be catalog-driven, skills must come from `public.skills` (org_id) and ratings from `public.employee_skills`.

---

## 2) Tables used (actual schema)
- **public.skills** – org_id, code, name, category (catalog per org).
- **public.employee_skills** – employee_id, skill_id, level (ratings).
- No `public.skills_catalog` or `public.employee_skill_ratings`; Spaljisten uses `sp_*` tables elsewhere. Competence Matrix uses `skills` + `employee_skills`.

---

## 3) Fixes applied
- Matrix page: stop calling `seedDemoDataIfEmpty`; matrix never seeds demo data.
- Matrix page: tenant-scoped only by `activeOrgId` (no `demoMode`-based fallback for data).
- `getEmployeesWithSkills`: load full skill catalog from `public.skills` for org; overlay ratings from `public.employee_skills`. Matrix shows all catalog skills; ratings from DB only.
- New GET `/api/skills`: returns skills for session `active_org_id` only (tenant-scoped).
- Purge SQL: see `sql/competence_matrix_db_check.sql` (optional, run manually for one org).

## 4) Verify

### Curl – fetch skills list (returns only DB skills for active org)
```bash
# With session cookie (replace BASE_URL and ensure you're logged in with active org set)
curl -s -b "sb-...cookie..." "https://BASE_URL/api/skills"
# Expected: { "skills": [ { "id": "...", "code": "...", "name": "...", "category": "..." }, ... ] }
```

### UI checklist
- Competence Matrix skills columns match `public.skills` for the active org exactly (no PRESS_A/B, 5S, SAFETY_BASIC, TRUCK_A1 unless they exist in DB for that org).
- With no skills in DB for the org, matrix shows "No competencies recorded yet" and no skill columns.
- With skills in DB and no employees (or filtered to none), matrix shows skill column headers and "No employees match the selected filters."

# Pilot import templates (stations + operational requirements)

These CSVs are **pilot "golden" templates** generated from the Gap Excel. They are for war-mode / one-time pilot use. No database writes are performed by the generator.

## Files

| File | Description |
|------|-------------|
| `stations.csv` | Stations with `station_code`, `station_name`, `line`, `area`, `is_active`. |
| `station_operational_requirements.csv` | Requirements per station: `required_headcount`, `required_skill_level` (default 2), `required_senior_count` (0). |

## Required fields

- **stations.csv**: `station_code` (string), `station_name` (string), `line` (sheet name), `area` (same as line), `is_active` (true).
- **station_operational_requirements.csv**: `station_code`, `required_headcount` (number; decimals allowed), `required_skill_level` (2), `required_senior_count` (0). Rows for placeholder stations may have `required_headcount` blank.

## How to rerun the generator

1. Place the Gap Excel at **`./data/gap_analys_2026.xlsx`** (or set `GAP_EXCEL_PATH` to the full path of your file, e.g. `GAP_EXCEL_PATH=/mnt/data/Gap analys medarbetarutveckling 2026.xlsx`).
2. From the repo root:
   ```bash
   npm run gen:pilot-templates
   ```
3. Output is written to `docs/import/templates/stations.csv` and `docs/import/templates/station_operational_requirements.csv`.

## Manual completion (Bearbetning / Underhåll)

The generator does **not** fully parse the sheets **Bearbetning** and **Underhåll**. It prints:

```text
Manual completion needed for sheets: Bearbetning, Underhåll
```

If those sheets contain rows where the first three columns have a numeric station code in column 3 and empty name/headcount, the script adds **placeholder** rows:

- In `stations.csv`: `station_name="(MISSING_NAME)"`.
- In `station_operational_requirements.csv`: `required_headcount` is left blank.

You must **manually fill**:

- Missing station names in `stations.csv` (replace `(MISSING_NAME)` with the real name).
- Missing `required_headcount` in `station_operational_requirements.csv` for those stations.

After editing, re-validate CSVs before any import.

## Import into the database

To persist stations and requirements via the API, ensure the migration that creates `public.station_operational_requirements` is applied in your active DB (e.g. `supabase/migrations/20260302100000_station_operational_requirements.sql`). Then call `POST /api/admin/import/stations` with JSON body `{ stationsCsv, requirementsCsv }` (admin/hr auth). The endpoint is idempotent: a second import with the same data yields `inserted: 0` and only updates existing rows.

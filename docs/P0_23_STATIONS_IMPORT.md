# P0.23 Stations import — Line Overview shows all lines (BEA/OMM/PAC/LOG/UND)

## Canonical rule (non-negotiable)

- **`stations.line`** MUST store the **LINE CODE** (BEA/OMM/PAC/LOG/UND), not a Swedish name.
- Swedish names are for display only (mapping in `lib/lineOverviewLineNames.ts` or `pl_lines.line_name`).
- **`stations.area_code`** is stored; **`stations.line`** must equal **`stations.area_code`**.

## Import route

- **POST** `/api/admin/master-data/stations/import`
- **Auth:** Session (admin or hr for active org). Optional: Bearer token.
- **Tenant:** Active org from session (no client override).
- **CSV columns (required):** `code`, `name`, `area_code`
- **Optional:** `is_active` (default `true`)
- **Upsert key:** `(org_id, area_code, code)`
- **Writes:** `org_id`, `code`, `name`, `area_code`, `line = area_code`, `is_active`

## Accept formats

1. **Multipart form:** field `file` = CSV file  
2. **JSON body:** `{ "csv": "<raw csv string>" }`  
3. **Raw body:** `Content-Type: text/csv` or `text/plain`

## curl examples

### 1) JSON body (inline CSV)

```bash
BASE="http://localhost:3000"
# Replace with your session cookie or Bearer token
curl -s -X POST "$BASE/api/admin/master-data/stations/import" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-...=..." \
  -d '{
    "csv": "code,name,area_code\nST1,Station 1,BEA\nST2,Station 2,BEA\nST3,Station 3,OMM\nST4,Station 4,PAC\nST5,Station 5,LOG\nST6,Station 6,UND"
  }' | jq .
```

### 2) Raw CSV body

```bash
curl -s -X POST "$BASE/api/admin/master-data/stations/import" \
  -H "Content-Type: text/csv" \
  -H "Cookie: sb-...=..." \
  --data-binary @stations.csv | jq .
```

### 3) Multipart file upload

```bash
curl -s -X POST "$BASE/api/admin/master-data/stations/import" \
  -H "Content-Type: multipart/form-data" \
  -H "Cookie: sb-...=..." \
  -F "file=@stations.csv" | jq .
```

### 4) Bearer token (if supported)

```bash
curl -s -X POST "$BASE/api/admin/master-data/stations/import" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"csv":"code,name,area_code\nST1,Station 1,BEA"}' | jq .
```

## Sample CSV (stations.csv)

```csv
code,name,area_code
ST1,Station Bearbetning 1,BEA
ST2,Station Bearbetning 2,BEA
ST3,Station Ommantling 1,OMM
ST4,Station Packen 1,PAC
ST5,Station Logistik 1,LOG
ST6,Station Underhåll 1,UND
```

## Migration (one-off normalization)

- **File:** `supabase/migrations/20260130130000_stations_area_code_and_normalize.sql`
- Adds `stations.area_code` and unique `(org_id, area_code, code)`.
- One-off: for org `slug = 'spaljisten'`, sets `stations.line = stations.area_code` where `area_code IS NOT NULL` and `line IS DISTINCT FROM area_code` (no guessing).

Run migrations before using the import so that `area_code` and the unique constraint exist.

## Verification

1. **SQL (Supabase SQL editor)**  
   After import and (if needed) normalization:
   ```sql
   SELECT line, count(*) FROM stations WHERE org_id = '<active_org_id>' GROUP BY line ORDER BY line;
   ```  
   Expected: multiple line codes (e.g. BEA, LOG, OMM, PAC, UND), not only "Bearbetning".

2. **API**  
   ```bash
   curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/line-overview/lines" | jq .
   ```  
   Expected: `lines` array with 5 entries (or N line codes), each with `line_code`, `line_name`, `station_count`.

3. **UI**  
   Line Overview page shows one card per line (e.g. 5 line cards when BEA/OMM/PAC/LOG/UND are present).

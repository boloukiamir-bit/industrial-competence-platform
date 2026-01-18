# Spaljisten Plan B Fallback

## If the UI Fails During Demo

### Option 1: Use Pre-Exported CSV
Location: `public/downloads/skill-gap-backup.csv` (if created)

Steps:
1. Open the CSV in Excel/Google Sheets
2. Filter by Risk Level column (CRITICAL, WARNING, OK)
3. Show the same data that would appear in dashboard

### Option 2: Direct API Access
If dashboard page fails but API works:

```bash
# Get dashboard data as JSON
curl https://[your-domain]/api/spaljisten/dashboard

# Export CSV directly
curl https://[your-domain]/api/spaljisten/export -o skill-gap-report.csv

# With area filter
curl "https://[your-domain]/api/spaljisten/export?areaId=[area-uuid]" -o filtered-report.csv
```

### Option 3: Database Query
If all APIs fail, run direct query:

```sql
-- Get skill gap summary
SELECT 
  s.skill_id,
  s.skill_name,
  COUNT(CASE WHEN es.rating >= 3 THEN 1 END) as independent_count,
  COUNT(es.id) as total_rated,
  CASE 
    WHEN COUNT(CASE WHEN es.rating >= 3 THEN 1 END) = 0 THEN 'CRITICAL'
    WHEN COUNT(CASE WHEN es.rating >= 3 THEN 1 END) = 1 THEN 'WARNING'
    ELSE 'OK'
  END as risk_level
FROM sp_skills s
LEFT JOIN sp_employee_skills es ON s.skill_id = es.skill_id AND s.org_id = es.org_id
WHERE s.org_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
GROUP BY s.skill_id, s.skill_name
HAVING COUNT(es.id) > 0
ORDER BY 
  CASE 
    WHEN COUNT(CASE WHEN es.rating >= 3 THEN 1 END) = 0 THEN 0
    WHEN COUNT(CASE WHEN es.rating >= 3 THEN 1 END) = 1 THEN 1
    ELSE 2
  END,
  COUNT(CASE WHEN es.rating >= 3 THEN 1 END);
```

---

## Pre-Demo Screenshots to Capture

Save these before the meeting in case of total failure:

1. **Dashboard with banner** - showing org name, counts, and thresholds
2. **Top 10 Risk Skills** - showing Critical/Warning/OK with explanations
3. **Area filter applied** - showing "Bearbetning" filter with results
4. **Exported CSV opened** - showing matching row count
5. **Expanded skill detail** - showing employee ratings

Save to: `docs/screenshots/` folder

---

## Emergency Contacts

- Technical support: [internal contact]
- Database access: Supabase dashboard
- Deployment: Replit dashboard

---

## Recovery Steps After Demo

If demo failed:
1. Note exact error message and time
2. Check browser console logs (F12)
3. Check server logs in Replit
4. Document issue for post-mortem

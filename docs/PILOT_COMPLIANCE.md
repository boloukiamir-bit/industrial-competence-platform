# Compliance & Competence — Pilot (5‑minute guide for Daniel)

## What it is

A **Compliance & Competence** module for Spaljisten: one place to see and manage **licenses**, **medical checks**, and **contracts** with validity, expiry, and alerts. Works for the whole organisation (not just production).

## 1. Open Compliance

- In the left nav, click **Compliance** (under Core).
- You see the **Compliance** overview: filters (Site, Search employee, Category tabs: License / Medical / Contract, Status: All / Valid / Expiring / Expired / Missing) and a **main table** (Employee, Department/Line, Item, Status badge, Valid to, Days left, Actions).

## 2. Set up the catalog (Admin/HR)

- Catalog = the list of compliance types (e.g. FORKLIFT_A, MEDICAL_ANNUAL, CONTRACT_FIXED_TERM).
- **In the UI**: On the Compliance page, click **Add catalog item** (top right). Fill code, name, category (License / Medical / Contract), optional description and default validity days, then Save.
- **Via API**: **POST /api/compliance/catalog/upsert** (Admin/HR only), body:  
  `{ "code": "FORKLIFT_A", "name": "Forklift license A", "category": "license", "description": "...", "default_validity_days": 365 }`  
  Categories: `license`, `medical`, `contract`.
- Once catalog items exist, they appear in the overview and in the employee drawer.

## 3. Assign compliance to an employee (Admin/HR)

- In the Compliance table, click a **row** (or **Edit**) to open the **right drawer**.
- In the drawer you see the employee name and a list of compliance items with status (VALID / EXPIRING / EXPIRED / MISSING / WAIVED).
- Click **Edit** on an item, then set:
  - **Valid from** / **Valid to** (dates)
  - **Evidence URL** (optional)
  - **Notes**
  - **Waived** (toggle)
- Click **Save** → toast “Saved” → list and overview refresh.

## 4. How status is computed

- **Valid**: `valid_to` is in the future and more than 30 days away.
- **Expiring**: `valid_to` is within the next 30 days (inclusive).
- **Expired**: `valid_to` is in the past.
- **Missing**: no row for that employee + catalog item.
- **Waived**: waiver ticked (no expiry required).

Status is computed **server-side** from dates; you only store dates and “waived”.

## 5. Employee profile

- Open **Employees** → choose an employee → **Compliance** tab.
- You see **3 cards**: Licenses, Medical, Contracts.
- Each card shows **counts** (Valid / Expiring / Expired / Missing) and **nearest expiry** (date + days).
- Link **“View all Compliance”** goes to the main Compliance page.

## 6. Requirements (station/role)

- **Requirements** (station skills) are unchanged: add/edit requirements on the Requirements page; only Admin/HR can edit; others see a **Read-only** banner.
- After saving a requirement change, the page **refetches** so badges and eligibility update immediately.

## 7. HR Templates

- **HR Templates** (left nav under HR Tools) lists workflow templates with categories: Onboarding, Offboarding, Medical, Contract.
- **Create Template** → goes to workflow template creation (name, category, task list).
- Open a template → **View & create instance for employee** → redirects to the workflow template detail where you can start an instance for an employee.

## 8. Auth and failures

- All compliance API calls use **credentials include** and **withDevBearer** (dev).
- **Read**: any org member. **Write** (catalog upsert, employee compliance upsert): Admin/HR only.
- APIs return **{ ok: false, step, error, details }** on failure; no silent failures.

## Build

- Run: `npm run build`.  
- Migrations: `supabase/migrations/20260201100000_compliance_catalog_and_employee_compliance.sql`.

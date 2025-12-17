# Industrial Competence Platform

## Overview
This project is an enterprise-grade competency management platform designed for industrial organizations. Its primary purpose is to streamline HR processes, manage employee competencies, and ensure compliance within Swedish/EU industrial contexts, with a strong focus on GDPR. The platform aims to provide comprehensive tools for HR and management to track skills, identify gaps, manage performance, and oversee operational aspects related to personnel and equipment.

## User Preferences
I want iterative development. Ask before making major changes.

## System Architecture
The platform is built using Next.js 15 with the App Router, TypeScript, and TailwindCSS for styling. Supabase (PostgreSQL) serves as the primary database.

**UI/UX Decisions:**
- **Design System:** Utilizes custom UI primitives (Button, Card, Badge, Input, Select, Textarea, Switch, Progress, Tabs, Checkbox) for a consistent look and feel.
- **Layouts:** Features a root layout and a dedicated application layout with a sidebar for navigation.
- **Dashboards:** Role-based dashboards (HR_ADMIN, MANAGER, EMPLOYEE) provide tailored views of relevant information, emphasizing key metrics, tasks, and risks.
- **Employee Hub:** A refactored "Person Hub" uses a left-side navigation pattern (Huma-style) for comprehensive employee management.
- **Color Schemes:** Critical risk badges use a specific `.hr-risk-pill--critical` CSS class.

**Technical Implementations:**
- **Core Functionality:** Includes modules for Competence Management (matrix, gap analysis, certifications), HR Core (employee data, performance reviews, salary, digital handbooks), and Operations (manager risk dashboard, equipment tracking, person events).
- **GDPR Support:** Implements access logging, data export, and anonymization utilities to ensure compliance.
- **API Routes:** Dedicated API routes for GDPR functionalities like employee data export.
- **Authentication/Authorization:** Supabase Auth with email/password login. Protected routes under `/app/*` redirect unauthenticated users to `/login`. Role-Based Access Control (RBAC) helpers are implemented for user management and role-based content visibility.
- **Multi-Tenant Architecture:** Organizations, memberships, and invites with full RLS (Row Level Security) enforcement. All data access is scoped by organization membership and enforced at the database level.
- **Org Context:** `useOrg` hook and `OrgProvider` manage current organization selection. `OrgGuard` component protects org-scoped pages.
- **HR Workflow Engine:** Manages standardized processes (e.g., sick leave, parental leave, onboarding) with templates, step tracking, due dates, and completion statuses.
- **Gap Analysis Engine:** Identifies critical skill gaps, training priorities, and overstaffed skills. "Tomorrow's Gaps v1" provides position-based risk/coverage analysis, calculating fully competent employee counts against minimum headcount requirements.
- **Notification Engine:** Features an email outbox and a cron endpoint for daily notifications.

**Feature Specifications:**
- **Competence Management:** Competency Matrix, Gap Analysis (position-based risk levels, coverage percentage), Safety/Certificates Tracking.
- **HR Core:** Employee Master Data, Performance Reviews (structured with templates), Salary Management (history, revisions), Digital Handbooks.
- **Operations:** Manager Risk Dashboard (tracking people events), Equipment Tracking, Unified Person Events (onboarding, offboarding).
- **Platform:** News Management, Document Library, CSV Employee Import, GDPR Support.
- **Advanced HR:** 1:1 Meetings System, Organization Overview (hierarchical chart), HR Analytics Dashboard (workforce metrics, attrition risk, workflows), HR Tasks dashboard.

**System Design Choices:**
- **Modular Services:** Functionality is encapsulated in dedicated services (e.g., `competenceService.ts`, `gaps.ts`, `employees.ts`, `gdpr.ts`) for better organization and maintainability.
- **Database Schema:** Designed with tables for employees, skills, reviews, salaries, equipment, person events, news, documents, GDPR logs, 1:1 meetings, organization units, absences, email outbox, and HR workflow instances.
- **Date-Awareness:** Competence profile and position coverage analysis functions are designed to be date-aware, allowing for historical or future analysis.

## Admin Console
- **Competence Admin (/admin/competence):** CRUD for competence groups and competences
- **Positions Admin (/admin/positions):** CRUD for positions
- **Position Requirements (/admin/positions/[id]/requirements):** Manage competence requirements per position
- **User Management (/app/admin/users):** Invite users, change roles, disable members (org admin only)
- **Audit Log (/app/admin/audit):** View organization activity history (org admin only)

## Multi-Tenant System
- **Organizations:** Each organization has a unique slug and is created by authenticated users
- **Memberships:** Users can belong to multiple orgs with roles: admin, hr, manager, user
- **Invites:** Pending invites auto-claimed when user signs up with matching email (via DB trigger)
- **RLS Policies:** All data tables enforce access via `is_org_member()` and `is_org_admin()` helper functions
- **Audit Logging:** All admin actions (org create, invite, role change, disable) are logged

## Server Routes (Protected, Service Role)
- `POST /api/org/create` - Create new organization (creator becomes admin)
- `POST /api/admin/invite` - Invite user by email (org admin only)
- `POST /api/admin/membership/role` - Change user role (org admin only)
- `POST /api/admin/membership/disable` - Disable user (org admin only)

## SQL Migrations
- `sql/create_profiles_table.sql` - User profiles table
- `sql/002_multi_tenant_rls.sql` - Organizations, memberships, invites, audit_logs with RLS

## Testing Infrastructure
- **Unit Tests:** Jest with ts-jest for TypeScript support (jest.config.cjs)
- **E2E Tests:** Playwright (playwright.config.ts) for browser testing
- **Accessibility Tests:** axe-core integration with Playwright for WCAG 2.0 AA compliance
- **Linting:** ESLint (eslint.config.mjs) for code quality
- **Formatting:** Prettier (.prettierrc) for consistent code style
- **Demo Mode:** Enabled via NEXT_PUBLIC_DEMO_MODE=true env var OR ?demo=true query param
- **Documentation:** See README_TESTING.md for full testing guide

## Competence Matrix Features
- **KPI Cards:** Total employees, at-risk count, top gap skill, average readiness percentage
- **Status Types:** OK (meets requirement), GAP (1 level below), RISK (2+ levels below or missing), N/A
- **Accessible Colors:** Theme tokens for status colors with AA contrast compliance
- **Premium Styling:** Sticky headers, zebra rows, hover effects, CSV export

## Known Limitations
- **Supabase Schema Cache:** The `min_headcount` column exists in the `positions` table but Supabase's PostgREST schema cache doesn't recognize it. This requires refreshing the schema cache through the Supabase dashboard (Database > API > Reload). The admin console currently excludes this field as a workaround.
- **Supabase Schema Cache for other columns:** Same issue may affect `sort_order` on competence_groups and `active` on competences if the schema cache is stale.

## External Dependencies
- **Supabase:** Used for database (PostgreSQL) and authentication services.
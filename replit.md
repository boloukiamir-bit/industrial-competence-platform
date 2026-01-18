# Industrial Competence Platform

## Overview
This project is an enterprise-grade competency management platform for industrial organizations. Its core purpose is to streamline HR processes, manage employee competencies, and ensure compliance within Swedish/EU industrial contexts, specifically focusing on GDPR. The platform offers comprehensive tools for HR and management to track skills, identify gaps, manage performance, and oversee operational aspects related to personnel and equipment.

## User Preferences
I want iterative development. Ask before making major changes.

## System Architecture
The platform is built using Next.js 15 with the App Router, TypeScript, and TailwindCSS for styling. Supabase (PostgreSQL) serves as the primary database.

**UI/UX Decisions:**
- **Design System:** Custom UI primitives ensure a consistent look and feel.
- **Layouts:** Features a root layout and an application layout with a sidebar for navigation.
- **Dashboards:** Role-based dashboards (HR_ADMIN, MANAGER, EMPLOYEE) provide tailored views, emphasizing key metrics and tasks.
- **Employee Hub:** A "Person Hub" utilizes a left-side navigation for comprehensive employee management.
- **Color Schemes:** Specific CSS classes are used for critical risk indicators.

**Technical Implementations:**
- **Core Functionality:** Modules for Competence Management (matrix, gap analysis, certifications), HR Core (employee data, performance reviews, salary, digital handbooks), and Operations (manager risk dashboard, equipment tracking, person events).
- **GDPR Support:** Includes access logging, data export, and anonymization utilities for compliance.
- **Authentication/Authorization:** Supabase Auth with email/password login and Role-Based Access Control (RBAC) for user management and content visibility.
- **Multi-Tenant Architecture:** Supports organizations, memberships, and invites with Row Level Security (RLS) enforcement at the database level.
- **Org Context:** A `useOrg` hook and `OrgProvider` manage current organization selection, with `OrgGuard` protecting org-scoped pages.
- **HR Workflow Engine:** Manages standardized processes with templates, step tracking, due dates, and completion statuses.
- **Gap Analysis Engine:** Identifies skill gaps, training priorities, and provides position-based risk/coverage analysis.
- **Notification Engine:** Features an email outbox and a cron endpoint for daily notifications.

**Feature Specifications:**
- **Competence Management:** Competency Matrix, Gap Analysis, Safety/Certificates Tracking.
- **HR Core:** Employee Master Data, Performance Reviews, Salary Management, Digital Handbooks.
- **Operations:** Manager Risk Dashboard, Equipment Tracking, Unified Person Events.
- **Platform:** News Management, Document Library, CSV Employee Import, GDPR Support.
- **Advanced HR:** 1:1 Meetings System, Organization Overview, HR Analytics Dashboard, HR Tasks dashboard.

**System Design Choices:**
- **Modular Services:** Functionality is encapsulated in dedicated services (e.g., `competenceService.ts`, `gdpr.ts`).
- **Database Schema:** Designed with tables for employees, skills, reviews, salaries, equipment, person events, news, documents, GDPR logs, 1:1 meetings, organization units, absences, email outbox, and HR workflow instances.
- **Date-Awareness:** Competence profile and position coverage analysis functions support historical or future analysis.

**Workflow System V1.1 (Demo-Ready):**
- **Templates (/app/workflows/templates):** Browse workflow templates with category colors
- **Template Builder (/app/workflows/templates/new):** Create custom templates with reorderable steps
- **Template Detail (/app/workflows/templates/[id]):** View steps, start workflow for employee
- **Instances (/app/workflows/instances):** View active/completed workflows with progress tracking
- **Instance Detail (/app/workflows/instances/[id]):** Task management with notes/evidence fields, sign-off, audit log
- **Dashboard (/app/workflows/dashboard):** KPIs (active workflows, overdue tasks, completed today), recent activity
- **My Tasks (/app/workflows/my-tasks):** Pending tasks with overdue/due-today badges

**V1.1 Features:**
- Task step forms with notes and evidence_url fields
- Supervisor/HR sign-off system with lock enforcement
- Template Builder: categories (Production, Safety, HR, Quality, Maintenance, Competence), owner roles, step management
- Risk-to-workflow integration: "Cross-train" button on Spaljisten risk rows

**Workflow API Routes:**
- `GET/POST /api/workflows/templates` - List/create templates
- `GET /api/workflows/templates/[id]` - Template details
- `POST /api/workflows/instances` - Start workflow
- `GET /api/workflows/instances/[id]` - Instance with tasks
- `PATCH /api/workflows/instances/[id]/tasks` - Update task
- `POST /api/workflows/instances/[id]/signoff` - Sign-off
- `GET /api/workflows/my-tasks` - Pending tasks
- `GET /api/workflows/dashboard` - KPIs

**Database Tables:** wf_templates, wf_template_steps, wf_instances, wf_instance_tasks, wf_audit_log
**Task Statuses:** todo, in_progress, done, blocked
**Sign-off Flow:** All tasks done → Supervisor sign-off → (Optional) HR sign-off → Locked

**Admin Console:**
- Provides CRUD operations for competence groups, competences, positions, and user management.
- Includes an audit log for organization activity history.

**Production Leader OS - Line Overview:**
- A "God Mode" visualization of production lines, machines, and staffing.
- Displays KPIs, machine grids with status indicators, and an assignment drawer.

**Spaljisten Go-Live MVP:**
- Provides skill matrix and gap analysis specifically for the customer Spaljisten.
- Includes a dashboard, CSV import functionality for areas, stations, employees, skills, and ratings, and CSV export of skill gap data.

## External Dependencies
- **Supabase:** Used for database (PostgreSQL) and authentication services.
- **pg Library:** Direct PostgreSQL connection for specific APIs to bypass Supabase schema cache issues.
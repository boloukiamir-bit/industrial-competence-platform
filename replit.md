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
- **Authentication/Authorization:** Role-Based Access Control (RBAC) helpers are implemented for user management and role-based content visibility.
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

## External Dependencies
- **Supabase:** Used for database (PostgreSQL) and potentially authentication services.
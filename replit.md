# Industrial Competence Platform

## Overview
Enterprise-grade competency management platform for industrial organizations. Built with Next.js 15, TypeScript, TailwindCSS, and Supabase. Includes HR Core features for Swedish/EU industrial companies with GDPR support.

## Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Database**: Supabase (PostgreSQL)

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page (landing)
│   ├── globals.css         # Global styles
│   ├── api/
│   │   └── gdpr/           # GDPR API routes
│   │       └── export-employee-data/  # Employee data export endpoint
│   └── app/                # Internal application area
│       ├── layout.tsx      # App layout with sidebar navigation
│       ├── dashboard/      # Dashboard (/app/dashboard)
│       ├── employees/      # Employee list (/app/employees)
│       │   └── [id]/       # Employee detail/person hub
│       │       ├── reviews/new/  # New performance review
│       │       └── salary/new/   # New salary revision
│       ├── competence-matrix/  # Competence matrix (/app/competence-matrix)
│       ├── tomorrows-gaps/ # Gap analysis (/app/tomorrows-gaps)
│       ├── import-employees/ # CSV import (/app/import-employees)
│       ├── manager/risks/  # Manager risk dashboard (/app/manager/risks)
│       ├── safety/certificates/  # Safety & certificates (/app/safety/certificates)
│       ├── equipment/      # Equipment management (/app/equipment)
│       ├── handbooks/      # Digital handbooks (/app/handbooks)
│       ├── news/           # News posts (/app/news)
│       ├── documents/      # Document library (/app/documents)
│       ├── pricing/        # Pricing page (/app/pricing)
│       └── settings/       # Settings (/app/settings)
├── components/
│   ├── ui/                 # UI primitives (Button, Card, Badge, Input, Select, Textarea)
│   ├── ManagerRiskCard.tsx # Risk event card component
│   ├── RiskListSection.tsx # Risk list grouping component
│   ├── WhatToFixSummary.tsx # Gap analysis summary component
│   ├── layout/             # Header, Footer
│   └── landing/            # Landing page sections
├── lib/
│   ├── utils.ts            # Utility functions (cn)
│   ├── supabaseClient.ts   # Supabase client
│   └── pricing.ts          # Pricing configuration
├── types/
│   ├── index.ts            # Type exports
│   └── domain.ts           # Domain types (Employee, Skill, Equipment, PersonEvent, ReviewTemplate, SalaryRecord, etc.)
├── services/
│   ├── competenceService.ts # Competence matrix operations
│   ├── gaps.ts             # Gap analysis engine
│   ├── events.ts           # People risk events management
│   ├── employees.ts        # Employee CRUD and data fetching
│   ├── reviews.ts          # Performance reviews / medarbetarsamtal
│   ├── salary.ts           # Salary records and revisions
│   ├── certificates.ts     # Safety certificates tracking
│   └── gdpr.ts             # GDPR access logging, data export, anonymization
├── public/                 # Static assets
├── supabase_schema.sql     # Database schema reference
└── design_guidelines.md    # UI/UX design guidelines
```

## Environment Variables
Copy `.env.example` to `.env.local` and configure:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

## Development
```bash
npm run dev    # Runs on http://0.0.0.0:5000
npm run build  # Build for production
npm run start  # Start production server
```

## Key Features

### Competence Management
- **Competency Matrix Management** - Track employee skills with level ratings (0-4)
- **Gap Analysis Engine** - Identify critical gaps, training priorities, and overstaffed skills
- **Safety/Certificates Tracking** - Monitor certifications like Heta arbeten, Truckkort

### HR Core
- **Employee Master Data** - Comprehensive person view with personal/employment info
- **Performance Reviews (Medarbetarsamtal)** - Structured reviews with templates, ratings, goals
- **Salary Management** - Track salary records and revisions with full history
- **Digital Handbooks** - Employee and manager handbook library

### Operations
- **Manager Risk Dashboard** - Track people events (contracts, medical checks, training)
- **Equipment Tracking** - Manage equipment assignments to employees
- **Person Events** - Unified compliance/task engine for onboarding, offboarding, delegations

### Platform
- **News Management** - Company news posts with pinning
- **Document Library** - Centralized document management with types
- **CSV Employee Import** - Bulk import employees from CSV
- **GDPR Support** - Access logging, data export, anonymization utilities

## Database Tables

### Core
- `employees` - Employee records with extended HR fields
- `skills` - Skill definitions with categories
- `employee_skills` - Employee-skill mappings with levels (0-4)
- `competence_requirements` - Required skills per line/role

### HR
- `review_templates` - Performance review templates
- `employee_reviews` - Performance review records with goals
- `salary_records` - Salary history with effective dates
- `salary_revisions` - Salary change records with reasons

### Operations
- `equipment` - Equipment inventory
- `employee_equipment` - Equipment assignments
- `person_events` - Risk events (contracts, training, medical, onboarding, offboarding)

### Content
- `news_posts` - Company news
- `documents` - Document library with types (handbook, contract, policy, certificate)

### Compliance
- `gdpr_access_logs` - Audit trail for profile access

## Services

### Gap Analysis (services/gaps.ts)
- `calculateTomorrowsGaps()` - Calculate all gaps for next shift
- `getCriticalGapsFromItems()` - Find critical missing competencies
- `getTrainingPriorities()` - Find skills needing training (levels 0-1)
- `getOverstaffedSkills()` - Find skills with excess capacity (levels 3-4)

### Events (services/events.ts)
- `getAllEvents()` - Fetch all events with status classification
- `markEventCompleted()` - Mark event as completed
- `extendDueDate()` - Extend event due date

### Employees (services/employees.ts)
- `getEmployees()` - List all active employees
- `getEmployeeById()` - Get employee with manager info
- `getEmployeeSkills()` - Get employee competencies
- `getEmployeeEvents()` - Get person events for employee
- `getEmployeeDocuments()` - Get documents attached to employee
- `getEmployeeEquipment()` - Get assigned equipment

### Reviews (services/reviews.ts)
- `getReviewTemplates()` - List active review templates
- `getEmployeeReviews()` - Get reviews for an employee
- `createReview()` - Create new performance review

### Salary (services/salary.ts)
- `getSalaryRecords()` - Get salary history
- `getCurrentSalary()` - Get current salary
- `getSalaryRevisions()` - Get revision history
- `createSalaryRevision()` - Record salary change

### GDPR (services/gdpr.ts)
- `logEmployeeAccess()` - Log profile access for audit
- `exportEmployeeData()` - Export all employee data (GDPR subject access request)
- `anonymizeEmployee()` - Anonymize personal data while preserving aggregate stats

### Certificates (services/certificates.ts)
- `getCertificates()` - Get safety/certificate data with training dates
- `getFilterOptionsForCertificates()` - Get filter options for UI

## Recent Changes (December 2024)
- Added HR Core: Employee list and person hub pages
- Added Performance Reviews with templates (Årligt medarbetarsamtal, Lönesamtal)
- Added Salary management with revision tracking
- Added Safety/Certificates page for compliance tracking
- Added Digital Handbooks page
- Added GDPR support layer with access logging and data export API
- Extended employees table with personal info fields
- Added review_templates, employee_reviews, salary_records, salary_revisions tables
- Added gdpr_access_logs table for audit trail
- Updated navigation with Employees, Safety/Certificates, Handbooks

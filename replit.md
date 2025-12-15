# Industrial Competence Platform

## Overview
Enterprise-grade competency management platform for industrial organizations. Built with Next.js 15, TypeScript, TailwindCSS, and Supabase.

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
│   └── app/                # Internal application area
│       ├── layout.tsx      # App layout with sidebar navigation
│       ├── dashboard/      # Dashboard (/app/dashboard)
│       ├── competence-matrix/  # Competence matrix (/app/competence-matrix)
│       ├── tomorrows-gaps/ # Gap analysis (/app/tomorrows-gaps)
│       ├── import-employees/ # CSV import (/app/import-employees)
│       ├── manager/risks/  # Manager risk dashboard (/app/manager/risks)
│       ├── equipment/      # Equipment management (/app/equipment)
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
│   └── domain.ts           # Domain types (Employee, Skill, Equipment, PersonEvent, etc.)
├── services/
│   ├── competenceService.ts # Competence matrix operations
│   ├── gaps.ts             # Gap analysis engine
│   └── events.ts           # People risk events management
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
- **Competency Matrix Management** - Track employee skills with level ratings
- **Gap Analysis Engine** - Identify critical gaps, training priorities, and overstaffed skills
- **Manager Risk Dashboard** - Track people events (contracts, medical checks, training)
- **Equipment Tracking** - Manage equipment assignments to employees
- **News Management** - Company news posts with pinning
- **Document Library** - Centralized document management
- **CSV Employee Import** - Bulk import employees from CSV
- **Pricing Configuration** - Business and Enterprise tiers

## Database Tables
- `employees` - Employee records
- `skills` - Skill definitions
- `employee_skills` - Employee-skill mappings with levels
- `competence_requirements` - Required skills per line/role
- `equipment` - Equipment inventory
- `employee_equipment` - Equipment assignments
- `person_events` - Risk events (contracts, training, medical)
- `news_posts` - Company news
- `documents` - Document library

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

## Recent Changes (December 2024)
- Added Manager Risks dashboard with event management
- Added Equipment tracking page with assignment workflow
- Added News management page
- Added Documents library page
- Added Pricing page with Business/Enterprise tiers
- Updated Tomorrow's Gaps to use real gap engine
- Extended sidebar navigation with all new pages
- Created Select and Textarea UI components
- Added domain types for Equipment, PersonEvent, NewsPost, Document

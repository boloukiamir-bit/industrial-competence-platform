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
│   └── globals.css         # Global styles
├── components/
│   ├── ui/                 # UI primitives (Button, Card, Badge, Input)
│   ├── layout/             # Header, Footer
│   └── landing/            # Landing page sections
├── lib/
│   ├── utils.ts            # Utility functions (cn)
│   └── supabase.ts         # Supabase client
├── types/                  # TypeScript types
├── services/               # API service layer
├── public/                 # Static assets
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
- Competency Matrix Management
- Certification Tracking
- Training Program Management
- Compliance Reporting
- User Authentication (via Supabase Auth)

## Recent Changes
- Converted from Vite + Express to Next.js 15 App Router
- Removed Wouter, using native Next.js routing
- Supabase client adapted for Next.js architecture
- Clean folder structure following Next.js conventions

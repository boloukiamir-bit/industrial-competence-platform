# Industrial Competence Platform

## Overview
Enterprise-grade competency management platform for industrial organizations. Built with React, TypeScript, TailwindCSS, and Supabase.

## Project Structure

```
├── client/                 # Frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/         # Shadcn UI components
│   │   │   ├── layout/     # Header, Footer, Layout components
│   │   │   └── landing/    # Landing page sections
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility functions and Supabase client
│   │   ├── pages/          # Route pages
│   │   ├── services/       # API service layer
│   │   └── types/          # TypeScript type definitions
│   └── public/             # Static assets
├── server/                 # Backend Express server
│   ├── routes.ts           # API routes
│   ├── storage.ts          # Storage interface (in-memory or database)
│   └── index.ts            # Server entry point
├── shared/                 # Shared code between frontend and backend
│   └── schema.ts           # Database schema and types
└── design_guidelines.md    # UI/UX design guidelines
```

## Tech Stack
- **Frontend**: React, TypeScript, TailwindCSS, Shadcn UI
- **Backend**: Express.js, Node.js
- **Database**: Supabase (PostgreSQL)
- **State Management**: TanStack Query
- **Routing**: Wouter

## Environment Variables
Copy `.env.example` to `.env.local` and configure:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SESSION_SECRET` - Server session secret

## Development
The application runs on port 5000 with Vite for frontend development and Express for the backend API.

## Key Features (Planned)
- Competency Matrix Management
- Certification Tracking
- Training Program Management
- Compliance Reporting
- User Authentication (via Supabase Auth)

## Recent Changes
- Initial project setup with landing page
- Supabase client configuration
- TypeScript types for competencies, certifications, and training programs
- Service layer structure for future API integrations

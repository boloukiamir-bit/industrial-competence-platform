# Industrial Competence Platform

Enterprise-grade competency management platform for industrial organizations.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | TailwindCSS, Shadcn UI |
| **Routing** | Wouter |
| **State Management** | TanStack Query |
| **Backend** | Express.js, Node.js |
| **Database** | Supabase (PostgreSQL) |
| **Schema Validation** | Zod, Drizzle ORM |

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/         # Shadcn UI components
│   │   │   ├── layout/     # Header, Footer components
│   │   │   └── landing/    # Landing page sections
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and Supabase client
│   │   ├── pages/          # Route pages
│   │   ├── services/       # API service layer
│   │   └── types/          # TypeScript type definitions
│   │   ├── App.tsx         # Main app component with routing
│   │   └── main.tsx        # App entry point
│   └── index.html          # HTML template
├── server/                 # Backend Express server
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # API routes
│   └── storage.ts          # In-memory storage interface
├── shared/                 # Shared code (frontend + backend)
│   └── schema.ts           # Database schema and Zod types
└── design_guidelines.md    # UI/UX design guidelines
```

## Main Entry Points

- **App Root**: `client/src/App.tsx` - Main React component with routing
- **Entry Point**: `client/src/main.tsx` - React DOM render
- **Landing Page**: `client/src/pages/landing.tsx` - Homepage
- **API Server**: `server/index.ts` - Express server

## Running the App in Replit

The app runs automatically via the configured workflow. To start manually:

```bash
npm run dev
```

This starts both the Express backend and Vite frontend on **port 5001**.

## Local API Verification

Use the dev-only bearer token to verify cockpit APIs locally (non-production only).

```bash
TOKEN=$(rg -m1 '^DEV_BEARER_TOKEN=' .env.local | sed 's/^DEV_BEARER_TOKEN=//')
curl -sS -4 -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:5001/api/debug/auth"
curl -sS -4 -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:5001/api/cockpit/summary?date=2026-02-17&shift_code=Day&line=all"
curl -sS -4 -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:5001/api/cockpit/issues?date=2026-02-17&shift_code=Day&line=all"
curl -sS -4 -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:5001/api/cockpit/compliance-summary?date=2026-02-17&shift_code=Day&line=all"
```

## Environment Variables

Create environment variables in the Replit Secrets tab:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key |
| `SESSION_SECRET` | Server session secret |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/competencies` | List all competencies |
| POST | `/api/competencies` | Create a competency |
| PATCH | `/api/competencies/:id` | Update a competency |
| DELETE | `/api/competencies/:id` | Delete a competency |
| GET | `/api/certifications` | List all certifications |
| POST | `/api/certifications` | Create a certification |
| PATCH | `/api/certifications/:id` | Update a certification |
| DELETE | `/api/certifications/:id` | Delete a certification |
| GET | `/api/training-programs` | List all training programs |
| POST | `/api/training-programs` | Create a training program |
| PATCH | `/api/training-programs/:id` | Update a training program |
| DELETE | `/api/training-programs/:id` | Delete a training program |
| GET | `/api/health` | Health check |

## Development Protocol

### END OF SESSION RULE (MANDATORY)

Before stopping work:

1. `npm run build`
2. `npm run git:safety`
3. `git push`

If branch is ahead or working tree dirty: **work is NOT complete.**

No exceptions.

**One command to finish a session:** `npm run ship` (runs build, git:safety, then push; fails if repo is dirty or ahead).

### End of session checklist

- Always run: **`npm run ship`**
- Never stop without a green ship (build + clean + synced + pushed).

Optional: install the terminal reminder so new shells warn when unpushed or dirty:

```bash
bash scripts/install_git_prompt_guard.sh
```

Then open a new terminal; you’ll see a red warning if the repo is dirty or the branch is ahead. Uninstall by removing the `git prompt guard` block from `~/.bashrc` (see comments in the script).

---

## Key Features (Planned)

- Competency Matrix Management
- Certification Tracking
- Training Program Management
- Compliance Reporting
- User Authentication (via Supabase Auth)

## License

MIT

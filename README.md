# DBGP Timing Marshal Panel

Next.js 14 App Router implementation of the Diamondback Grand Prix timing marshal panel with Supabase persistence and realtime fan-out.

## Tech Stack

- Next.js 14 (TypeScript, App Router) with Turbopack dev server
- Tailwind CSS and shadcn/ui primitives
- Zustand for local session and UI state
- Supabase (Postgres, Auth, Realtime) for durable storage
- pnpm for dependency management

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase CLI (`brew install supabase/tap/supabase`)

Optional:

- Vercel CLI for deployment workflows

### Installation

1. Copy `.env.example` to `.env.local` and set Supabase credentials.
2. Install dependencies (requires registry access):

   ```bash
   pnpm install
   ```

3. Initialise Supabase locally:

   ```bash
   supabase init
   supabase start
   supabase migration up
   supabase db reset --use-migra --seed supabase/seed.sql # optional seed
   ```

4. Generate local types (after database is running):

   ```bash
   pnpm run db:types
   ```

5. Start the dev server:

   ```bash
   pnpm dev
   ```

The operator console is served from `/` and the read-only viewer is available at `/viewer`.

### Scripts

- `pnpm dev` – run the Next.js dev server
- `pnpm build` – create a production build
- `pnpm start` – start the production server
- `pnpm lint` – run ESLint
- `pnpm db:types` – generate Supabase TypeScript definitions
- `pnpm db:up` – apply pending migrations to the current database
- `pnpm db:reset` – reset and reseed the local database

## Database

SQL migrations are stored in `supabase/migrations`. The initial schema (`0001_init.sql`) defines teams, drivers, sessions, laps, events, and penalties along with row level security policies and helper RPCs (`create_session`, `capture_lap`). Seed data lives in `supabase/seed.sql` and can be applied via `supabase db reset --seed supabase/seed.sql`.

## Supabase Realtime

Both the operator console and the viewer subscribe to Supabase realtime channels (`postgres_changes`) to receive session, lap, and event updates instantly.

## Export API

`GET /api/export?sessionId=<uuid>` generates a CSV export of laps (including driver metadata). The route prefers `SUPABASE_SERVICE_ROLE_KEY` but will fall back to the public anon key for read-only access.

## UI Architecture

- `src/components` – shared UI primitives including the clock, event log, driver tile, and flag toolbar
- `src/store/useSessionStore.ts` – Zustand store that caches the active session graph and manages capture debounce
- `src/lib` – Supabase client helpers, timing utilities, and finite state machine transitions
- `src/app` – App Router routes for the operator and viewer experiences, plus the export API route

## Deployment

1. Link the Supabase project and push migrations (`supabase link`, `supabase db push`).
2. Deploy the Next.js app to Vercel and configure environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
3. Set up Supabase Auth with magic links for staff access; extend RLS policies when moving to production.

## Testing Checklist

- Final call -> start -> finish transitions update session state and emit events.
- Lap capture enforces per-driver debounce and supports undo.
- Viewer reflects realtime lap and flag changes.
- CSV export downloads classification data successfully.
- RLS ensures read-only viewer vs. staff writer separation.

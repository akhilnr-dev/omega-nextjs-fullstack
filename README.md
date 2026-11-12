# omega-nextjs-fullstack

A full-stack Next.js app for testing Amplify apps with a database backend. Deploying this repo
creates a Postgres backend, applies the SQL files in `migrations/`, and serves a small project
tracker (projects, tasks, comments) that reads and writes that database.

## Deploy

1. Create an app with this repo as the source and enable the database and authentication backend.
   A `migrations/` folder at the repo root is what signals that the app needs a backend.
2. Deploy. The platform builds the app (`next build`), creates the backend and applies the migrations.
3. Open the app URL. The Backend card should show "All migrations applied" and every object as
   Present, and the seeded "Demo project" should be listed.

The platform injects `AMPLIFY_BACKEND_URL` and `AMPLIFY_BACKEND_PUBLISHABLE_KEY` at runtime.
No environment variables need to be set by hand.

## Migrations

| File | Creates |
| --- | --- |
| `20261101000000_create_projects.sql` | `projects` table, `project_visibility` enum, `set_updated_at()` trigger, RLS |
| `20261101000100_create_tasks.sql` | `tasks` table (FK to `projects`, cascade delete), status and priority enums, RLS |
| `20261101000200_create_comments_and_views.sql` | `comments` table, `project_task_counts` view |
| `20261101000300_add_labels_and_seed.sql` | `tasks.labels` column (`ALTER TABLE`), public demo project with 3 tasks |
| `20261101000400_grant_api_roles.sql` | Table privileges for the `anon` and `authenticated` roles |

Rules:

- Filenames must match `^\d{14}_.+\.sql$`, and tables go in the `public` schema.
- Migrations are append-only. Never edit or rename an applied file; add a new one.
- New tables need `GRANT`s for `anon` / `authenticated`, or the data API returns `42501`.
  RLS policies then decide which rows each caller sees.

## Verifying

- `GET /api/status` returns the backend and migration state as JSON (`allMigrationsApplied`).
- Signed out, only public projects are visible. After signing up, users can create projects,
  add tasks, change status and comment, and only see their own private projects.

## Local development

Requires Node 20.9 or later.

```bash
npm ci
cp .env.example .env.local   # point at an existing backend
npm run dev
```

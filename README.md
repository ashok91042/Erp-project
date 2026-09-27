# AcademicERP — React + Next.js + Tailwind CSS

Academic ERP dashboard with a **frontend** and a **backend**, split into two folders.

## Project structure

```
academic-erp-client/
├── frontend/          Next.js 15 App Router client (port 3000)
│   ├── app/           routes: /login /portal /principal /teacher /parent
│   ├── components/    shared UI (AppShell, Sidebar, tables, charts, modal…)
│   ├── lib/           api.js, auth.js, supabase.js
│   ├── public/        static assets
│   ├── next.config.mjs  proxies /api/* → backend (API_ORIGIN)
│   └── package.json
├── backend/           Express + Postgres API (port 4000)
│   ├── src/           server.js, routes/, middleware/, db/, mailer.js
│   ├── sql/           schema.sql (tables, RLS, seed data)
│   ├── tests/         Jest suites
│   ├── scripts/       seed-passwords.js
│   └── package.json
└── package.json       root scripts that drive both
└── vercel.json       deploys both as services of one Vercel project
```

## Included
- Next.js App Router
- React
- Tailwind CSS
- **Email + password login** (bcrypt hashes, signed JWT session, `Authorization: Bearer …`)
- Role-scoped dashboards, tables and charts — all numbers come from the live API
- Express API (in `backend/`) with Supabase Postgres, RBAC and row-level scoping
- Principal: users (add/edit/delete students), students, teachers, parents, attendance, marks, requests, reports, settings
- Teacher: classes, students, attendance, marks, requests, notifications
- Parent: child, attendance, marks, notifications, settings
- Reusable components, Supabase integration placeholder in `frontend/lib/supabase.js`

## Run in VS Code

The app needs **two processes**: the Next.js frontend (port 3000) and the Express API (port 4000).

Install both:

```bash
npm run install:all
```

Terminal 1 — API backend (required for data):

```bash
npm run api        # or: cd backend && npm install && npm start
```

Terminal 2 — frontend:

```bash
npm run dev
```

Open `http://localhost:3000` and pick a workspace.

> ⚠️ If pages show **"API error: Failed to fetch"** (or empty tables),
> the backend in Terminal 1 isn't running. Start it first, then check
> `http://localhost:4000/api/health` returns `{"status":"ok",...}`.

## Login

Sign in at `/login` with an email and password. The API verifies the bcrypt
hash and returns a signed JWT, which the client stores and sends as
`Authorization: Bearer …` on every request. **Role and permissions always come
from the `users` table**, so a token cannot escalate privileges.

Demo accounts (all use the password `demo1234`):

- Principal → `principal@school.edu`
- Teacher → `lakshmi@school.edu`
- Parent → `parent.demo@mail.com`

Set (or reset) the demo passwords with:

```bash
cd backend
node scripts/seed-passwords.js            # uses demo1234
node scripts/seed-passwords.js MyPass123  # custom
```

Users can change their own password from the API
(`PATCH /api/auth/password`). The sidebar **Logout** clears the session.

### Server configuration

Add to `backend/.env`:

```bash
APP_JWT_SECRET=<long random string>   # signs session tokens — keep private
APP_JWT_EXPIRES=8h                   # optional
RL_LOGIN_MAX=10                      # optional: sign-in attempts per window
```

Login fails closed with `503` if no signing secret is set.

## Tests

```bash
npm test           # runs the server Jest suite against the real database
```

## Deploy to Vercel

`vercel.json` deploys the repo as **one project with two services** — a Next.js
frontend and the Express API — behind a single domain. Push the repo, import it
at [vercel.com/new](https://vercel.com/new), and set the environment variables
below. Each service is built from its own `root`, so there is no root build
command to configure.

### 1. Environment variables

The `.env` files are gitignored, so nothing is deployed with the repo — set
these in **Project → Settings → Environment Variables**.

| Variable | Service | Required | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | backend | ✅ | Supabase Postgres. Use the **transaction pooler** (port `6543`) — serverless opens a lot of concurrent connections. |
| `APP_JWT_SECRET` | backend | ✅ | Signs session tokens. Login fails closed with `503` without it. |
| `ALLOW_DEMO_HEADERS` | backend | ✅ | Must be `false`, or anyone can impersonate a principal. |
| `CORS_ORIGIN` | backend | ➖ | Not needed — the app and the API share one origin. |
| `NEXT_PUBLIC_API_BASE` | frontend | ➖ | Leave empty. It defaults to `/api/backend` on Vercel. |
| `API_ORIGIN` | frontend | ❌ | Leave **unset** here. Setting it re-enables the Next.js proxy, which points at `localhost:4000` and breaks the API. |
| `DB_POOL_MAX` | backend | ➖ | Postgres connections per instance (default 5 on Vercel). |

### 2. Seed the database

The schema lives in `backend/sql/schema.sql`. Run it once against your Supabase
project (SQL editor, or `psql "$DATABASE_URL" -f backend/sql/schema.sql`), then
optionally set the demo passwords:

```bash
cd backend
node scripts/seed-passwords.js
```

### 3. Verify

Open the deployment and check the API is alive through the service prefix:

```
https://<your-domain>/api/backend/api/health   →  {"status":"ok", ...}
```

### How the routing works

```
/api/backend/api/health  ──▶ rewrite 1 ──▶ backend service
                                            request.path transform strips
                                            "/api/backend" ⇒ Express sees
                                            /api/health
/(.*)                     ──▶ rewrite 2 ──▶ frontend service (Next.js)
```

The `request.path` transform inside the backend service is required: Vercel
hands a service the **original** request path, so without it Express would look
for `/api/backend/api/health` and return `404 {"error":"Not found"}`.

Locally, `vercel dev` serves the same routing. Plain `npm run dev` +
`npm run api` keeps using the Next.js proxy instead — both are supported.

# Erp-project

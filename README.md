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

Both apps deploy as **two services in one Vercel project** (Beta), configured by
`vercel.json` at the repo root:

```json
{ "services": { "frontend": { "root": "frontend/" },
                "backend":  { "root": "backend/", "entrypoint": "src/server.js" } },
  "rewrites": [ { "source": "/api/(.*)", "destination": { "service": "backend" } },
                { "source": "/(.*)",      "destination": { "service": "frontend" } } ] }
```

Set the Vercel **Root Directory** to the repo root (not `frontend/`) so both
services are found. Add the `backend/.env` values as project env vars
(`DATABASE_URL`, `APP_JWT_SECRET`, `CORS_ORIGIN`, `ALLOW_DEMO_HEADERS=false`).

Two things that are easy to get wrong here:

- **Do not prefix the API with `/api/backend`.** A service destination passes the
  *original* request path through to the service (the optional `path` field only
  selects a route, it does not rewrite the URL the code sees), and every Express
  route is mounted under `/api`. `lib/api.js` therefore calls `/api/...` in both
  dev and production; only *which server* answers changes.
- **Leave `API_ORIGIN` and `NEXT_PUBLIC_API_BASE` unset on Vercel.** Setting
  either re-enables the local-dev proxy in `next.config.mjs`, which would forward
  requests to `http://localhost:4000` and break platform routing.

> A `destination` that is a full URL (`https://backend.example.com/:path*`) is
> only for a backend hosted as a *separate* project/deployment — it will not
> resolve to a service in this one.

# Erp-project

# Academic ERP — Backend (Node.js + Express + Supabase Postgres)

## Setup
```bash
cd backend
npm install
npm run db:init   # applies sql/schema.sql (tables, RLS, seed data)
npm run dev       # starts API on http://localhost:4000
```
Configuration lives in `backend/.env` (DATABASE_URL, SUPABASE_ANON_KEY, SMTP creds, CORS_ORIGIN).

## Endpoints
| Method | Path | Role required | Description |
|---|---|---|---|
| GET  | `/` | — | Service banner (name, status, pointers) |
| GET  | `/api/health` | — | DB connectivity check |
| GET  | `/api/students` | — | Class roster |
| GET / POST | `/api/marks` | teacher/principal for POST | Marks entry (upsert by student+subject+exam) |
| GET  | `/api/attendance?date=YYYY-MM-DD` | — | Roster with FN/AN attendance for a date |
| POST | `/api/attendance` | teacher/principal | Upsert attendance; auto-emails parents on FN/AN absence |
| GET / POST | `/api/requests` | teacher/principal | Permission requests (teachers see own; principal all) |
| PATCH | `/api/requests/:id/decide` | principal | Approve/reject → emails the teacher |

## Auth
Requests should send `Authorization: Bearer <supabase-jwt>`. The middleware decodes the JWT
(email/sub). For quick local testing without Supabase Auth, send `x-demo-email` +
`x-demo-role` headers — the user is resolved from the `users` table by email.
(For production, verify the JWT signature against Supabase's secret/JWKS.)

## Email notifications
Configured via SMTP env vars. When SMTP is absent (default), alerts log to the console
(`[mailer:dev]`) so the workflow is testable without real credentials. Set
`SMTP_HOST/SMTP_USER/SMTP_PASS` and `NOTIFY_EMAIL` (or student `parent_email` in DB) to send real emails.

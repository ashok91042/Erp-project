# AcademicERP — React + Next.js + Tailwind CSS

Frontend-only AcademicERP dashboard inspired by the supplied UI reference.

## Included
- Next.js App Router
- React
- Tailwind CSS
- **Email + password login** (bcrypt hashes, signed JWT session, `Authorization: Bearer …`)
- Role-scoped dashboards, tables and charts — all numbers come from the live API
- Express API (in `server/`) with Supabase Postgres, RBAC and row-level scoping
- Principal: users (add/edit/delete students), students, teachers, parents, attendance, marks, requests, reports, settings
- Teacher: classes, students, attendance, marks, requests, notifications
- Parent: child, attendance, marks, notifications, settings
- Reusable components, Supabase integration placeholder in `lib/supabase.js`

## Run in VS Code

The app needs **two processes**: the Next.js frontend (port 3000) and the Express API (port 4000).

```bash
cd academic-erp-client
npm install
```

Terminal 1 — API backend (required for data):

```bash
npm run api        # or: cd server && npm install && npm start
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
cd server
node scripts/seed-passwords.js            # uses demo1234
node scripts/seed-passwords.js MyPass123  # custom
```

Users can change their own password from the API
(`PATCH /api/auth/password`). The sidebar **Logout** clears the session.

### Server configuration

Add to `server/.env` (see `server/.env.example`):

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

# AcademicERP — React + Next.js + Tailwind CSS

Frontend-only AcademicERP dashboard inspired by the supplied UI reference.

## Included
- Next.js App Router
- React
- Tailwind CSS
- Session-based login using `sessionStorage`
- Protected role routes for Principal, Teacher and Parent
- Responsive sidebar/header/dashboard UI
- Principal: users, students, teachers, parents, attendance, marks, requests, reports, settings
- Teacher: classes, students, attendance, marks, requests, notifications
- Parent: child, attendance, marks, notifications, settings
- Reusable components and mock data
- Supabase integration placeholder in `lib/supabase.js`

## Run in VS Code

The app needs **two processes**: the Next.js frontend (port 3000) and the Express API (port 4000).

```bash
cd academic-erp-client
npm install
```

Terminal 1 — API backend (required for login):

```bash
npm run api        # or: cd server && npm install && npm start
```

Terminal 2 — frontend:

```bash
npm run dev
```

Open `http://localhost:3000`.

> ⚠️ If login shows **"Login failed: Failed to fetch. Is the API running on :4000?"**,
> the backend in Terminal 1 isn't running. Start it first, then check
> `http://localhost:4000/api/health` returns `{"status":"ok",...}`.

## Demo login

Pick a role on the login screen — the email must match that role's demo account
(any password of 4+ characters works):

- Principal: `principal@school.edu` / `demo123`
- Teacher: `lakshmi@school.edu` / `demo123`
- Parent: `parent.demo@mail.com` / `demo123`

The selected role and user are stored in `sessionStorage`, so closing the browser tab ends the session. Use Logout to clear the session immediately.

## Replace demo authentication

When connecting a real backend, replace `lib/auth.js` and the login submit handler with your authentication API/Supabase Auth. Do not put private service-role keys in frontend code.

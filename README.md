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

```bash
cd academic-erp-client
npm install
npm run dev
```

Open `http://localhost:3000`.

## Demo login

Any valid email + password of 4+ characters works. Select a role before clicking Login.

Example:
- Principal: `principal@academic-erp.com` / `demo123`
- Teacher: `teacher@academic-erp.com` / `demo123`
- Parent: `parent@academic-erp.com` / `demo123`

The selected role and user are stored in `sessionStorage`, so closing the browser tab ends the session. Use Logout to clear the session immediately.

## Replace demo authentication

When connecting a real backend, replace `lib/auth.js` and the login submit handler with your authentication API/Supabase Auth. Do not put private service-role keys in frontend code.

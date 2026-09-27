import { getToken } from "./auth";

// Real API layer — talks to the Express backend (backend/).
//
// LOCAL DEV — the default "" calls the API same-origin (/api/...), which
// next.config.mjs proxies to the backend via API_ORIGIN. That sidesteps CORS
// and mixed-content failures ("Failed to fetch") when the app is opened through
// 127.0.0.1, a different port, or an https tunnel.
//
// VERCEL — the default becomes "/api/backend", because vercel.json routes that
// prefix to the backend *service*. The browser and the API therefore share one
// origin, exactly as in local dev, so there is no CORS to configure.
//
// Override either way with NEXT_PUBLIC_API_BASE (e.g. "http://localhost:4000"
// to call the API directly, which then requires CORS on the backend).
//
// Auth: the bearer token from POST /api/auth/login is sent on every request
// (see lib/auth.js). The server verifies the signature and resolves the real
// role from the users table, so the token cannot escalate privileges.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || (process.env.NEXT_PUBLIC_VERCEL_ENV ? "/api/backend" : "");

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    // A non-JSON body means the response never came from the API server: the
    // Next.js /api rewrite proxy could not reach the backend (it is down, or
    // not on API_ORIGIN). Every API error path returns JSON, so say what is
    // actually wrong instead of a bare "Request failed (500)".
    if (data === null) {
      throw new Error(
        `Cannot reach the API (${res.status}). Is the backend running? Start it with: npm run api`
      );
    }
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const login = (email, password) =>
  api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const getSession = () => api("/api/auth/session");
export const changePassword = (currentPassword, newPassword) =>
  api("/api/auth/password", { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) });

export const getStudents = () => api("/api/students");
export const getClasses = () => api("/api/classes");
export const createStudent = (body) => api("/api/students", { method: "POST", body: JSON.stringify(body) });
export const updateStudent = (id, body) => api(`/api/students/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteStudent = (id) => api(`/api/students/${id}`, { method: "DELETE" });
export const getMarks = () => api("/api/marks");
export const saveMarks = (body) => api("/api/marks", { method: "POST", body: JSON.stringify(body) });
export const getAttendance = (date) => api(`/api/attendance?date=${date}`);
export const saveAttendance = (body) => api("/api/attendance", { method: "POST", body: JSON.stringify(body) });
export const getRequests = (status) => api(`/api/requests${status ? `?status=${status}` : ""}`);
export const createRequest = (body) => api("/api/requests", { method: "POST", body: JSON.stringify(body) });
export const decideRequest = (id, body) => api(`/api/requests/${id}/decide`, { method: "PATCH", body: JSON.stringify(body) });
export const getMe = () => api("/api/me");
export const getStats = () => api("/api/stats");
export const getTeachers = () => api("/api/teachers");
export const createTeacher = (body) => api("/api/teachers", { method: "POST", body: JSON.stringify(body) });
export const updateTeacher = (id, body) => api(`/api/teachers/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteTeacher = (id) => api(`/api/teachers/${id}`, { method: "DELETE" });
export const getParents = () => api("/api/parents");
export const createParent = (body) => api("/api/parents", { method: "POST", body: JSON.stringify(body) });
// Parents are keyed by email (it is the students.parent_email link), so it is URL-encoded.
export const updateParent = (email, body) => api(`/api/parents/${encodeURIComponent(email)}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteParent = (email) => api(`/api/parents/${encodeURIComponent(email)}`, { method: "DELETE" });

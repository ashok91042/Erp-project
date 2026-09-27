import { getToken } from "./auth";

// Real API layer — talks to the Express backend (server/).
//
// By default we call the backend SAME-ORIGIN ("" → /api/...), which Next.js
// proxies to it via the rewrite in next.config.mjs. That sidesteps CORS and
// mixed-content failures ("Failed to fetch") when the app is opened through
// 127.0.0.1, a different port, or an https tunnel. Set NEXT_PUBLIC_API_BASE
// (e.g. "http://localhost:4000") to call the API directly instead.
//
// Auth: the bearer token from POST /api/auth/login is sent on every request
// (see lib/auth.js). The server verifies the signature and resolves the real
// role from the users table, so the token cannot escalate privileges.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

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
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
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

// Real API layer — talks to the Express backend (server/).
//
// By default we call the backend SAME-ORIGIN ("" → /api/...), which Next.js
// proxies to it via the rewrite in next.config.mjs. That sidesteps CORS and
// mixed-content failures ("Failed to fetch") when the app is opened through
// 127.0.0.1, a different port, or an https tunnel. Set NEXT_PUBLIC_API_BASE
// (e.g. "http://localhost:4000") to call the API directly instead.
//
// Auth context comes from the demo session (erp_role / erp_user) and is
// forwarded as x-demo-email / x-demo-role headers; swap for the Supabase
// JWT in Authorization when Supabase Auth is enabled.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

function authHeaders() {
  if (typeof window === "undefined") return {};
  let user = null;
  try { user = JSON.parse(sessionStorage.getItem("erp_user") || "null"); } catch {}
  return {
    "x-demo-email": user?.email || "",
    "x-demo-role": sessionStorage.getItem("erp_role") || "",
  };
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

export const getStudents = () => api("/api/students");
export const getClasses = () => api("/api/classes");
export const createStudent = (body) => api("/api/students", { method: "POST", body: JSON.stringify(body) });
export const getMarks = () => api("/api/marks");
export const saveMarks = (body) => api("/api/marks", { method: "POST", body: JSON.stringify(body) });
export const getAttendance = (date) => api(`/api/attendance?date=${date}`);
export const saveAttendance = (body) => api("/api/attendance", { method: "POST", body: JSON.stringify(body) });
export const getRequests = (status) => api(`/api/requests${status ? `?status=${status}` : ""}`);
export const createRequest = (body) => api("/api/requests", { method: "POST", body: JSON.stringify(body) });
export const decideRequest = (id, body) => api(`/api/requests/${id}/decide`, { method: "PATCH", body: JSON.stringify(body) });

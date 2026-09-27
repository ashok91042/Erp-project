// Session helpers for the bearer-token login flow.
// The token is issued by POST /api/auth/login, stored in localStorage and sent
// as `Authorization: Bearer …` on every API call (see lib/api.js).

const TOKEN_KEY = "erp.token";
const USER_KEY = "erp.user";

export const ROLES = ["principal", "teacher", "parent"];

export function getToken() {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function getUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
}

export function setSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

export function signOut() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch {}
}

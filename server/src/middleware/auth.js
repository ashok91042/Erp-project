/**
 * Authentication & identity middleware.
 *
 * Security model:
 *  1. Bearer tokens are Supabase JWTs — signature VERIFIED (HS256) against
 *     SUPABASE_JWT_SECRET. Claims (`email`, `role=authenticated`) are validated;
 *     identity/role are then resolved from the DB — the token `sub` is never
 *     trusted as a user id.
 *  2. Demo headers (x-demo-email / x-demo-role) are ONLY honored when
 *     ALLOW_DEMO_HEADERS=true or outside production. Even then, role comes
 *     exclusively from the users table — headers cannot grant privileges.
 */
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function demoAllowed() {
  if (process.env.ALLOW_DEMO_HEADERS === "true") return true;
  if (process.env.ALLOW_DEMO_HEADERS === "false") return false;
  return process.env.NODE_ENV !== "production"; // default: dev/test only
}

async function resolveUserByEmail(email) {
  const { rows } = await pool.query("select id, role from public.users where email = $1", [email]);
  return rows[0] || null;
}

async function attachUser(req, res, next) {
  req.user = null;

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (token) {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      return res.status(503).json({ error: "Auth configuration error" });
    }
    let payload;
    try {
      payload = jwt.verify(token, secret, { algorithms: ["HS256"] }); // rejects forged/expired/malformed
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : null;
    if (!email || !EMAIL_RE.test(email) || payload.role !== "authenticated") {
      return res.status(401).json({ error: "Invalid token claims" });
    }
    const user = await resolveUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Unknown user" });
    req.user = { id: user.id, role: user.role, email }; // role is DB-authoritative
    return next();
  }

  // Demo mode (dev/test only): identity strictly from DB by email.
  const demoEmail = req.headers["x-demo-email"];
  if (demoAllowed() && typeof demoEmail === "string" && EMAIL_RE.test(demoEmail)) {
    try {
      const user = await resolveUserByEmail(demoEmail.trim().toLowerCase());
      if (user) req.user = { id: user.id, role: user.role, email: demoEmail.trim().toLowerCase() };
    } catch (e) {
      console.error("[auth] demo lookup failed:", e.message);
    }
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden — requires role: ${roles.join(" or ")}` });
    }
    next();
  };
}

module.exports = { attachUser, requireRole, EMAIL_RE };
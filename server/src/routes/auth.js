const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const { requireRole, EMAIL_RE } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimit");

const router = express.Router();

/** Secret used to sign session tokens. Fails closed when unset (no fallback secret). */
const secret = () => process.env.APP_JWT_SECRET || process.env.SUPABASE_JWT_SECRET || null;

const signToken = (user) =>
  jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.full_name },
    secret(),
    { algorithm: "HS256", expiresIn: process.env.APP_JWT_EXPIRES || "8h" }
  );

/**
 * POST /api/auth/login  { email, password }
 * Verifies the bcrypt hash and returns a signed session token plus the profile.
 * Always answers with a generic message so accounts cannot be enumerated.
 */
router.post("/login", loginLimiter, async (req, res) => {
  if (!secret()) return res.status(503).json({ error: "Auth is not configured on the server" });

  const { email, password } = req.body || {};
  if (typeof email !== "string" || !EMAIL_RE.test(email) || typeof password !== "string" || password.length < 4) {
    return res.status(400).json({ error: "Enter a valid email and password" });
  }

  const { rows } = await pool.query(
    "select id, email, full_name, role, password_hash from public.users where lower(email) = lower($1)",
    [email.trim()]
  );
  const user = rows[0];
  // Hash a dummy value when the account is unknown so response timing is similar
  const hash = user && user.password_hash ? user.password_hash : "$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012";
  const ok = user && user.password_hash ? await bcrypt.compare(password, hash) : false;

  if (!ok) return res.status(401).json({ error: "Invalid email or password" });

  res.json({
    token: signToken(user),
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
  });
});

/** PATCH /api/auth/password — change your own password while signed in. */
router.patch("/password", requireRole("principal", "teacher", "parent"), async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "Current password and a new password of 8+ characters are required" });
  }
  const { rows } = await pool.query("select password_hash from public.users where id = $1", [req.user.id]);
  const current = rows[0] && rows[0].password_hash;
  if (!current || !(await bcrypt.compare(currentPassword, current))) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  await pool.query("update public.users set password_hash = $1 where id = $2", [
    await bcrypt.hash(newPassword, 10),
    req.user.id,
  ]);
  res.json({ updated: true });
});

/** GET /api/auth/session — validate the stored token (used on app boot). */
router.get("/session", requireRole("principal", "teacher", "parent"), async (req, res) => {
  const { rows } = await pool.query(
    "select id, email, full_name, role from public.users where id = $1",
    [req.user.id]
  );
  res.json({ user: rows[0] || { id: req.user.id, email: req.user.email, role: req.user.role } });
});

module.exports = router;

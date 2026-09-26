const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const { attachUser, requireRole, EMAIL_RE } = require("./middleware/auth");
const { globalLimiter, writeLimiter } = require("./middleware/rateLimit");
const { ownsStudent, UUID_RE } = require("./middleware/ownership");
const attendanceRoutes = require("./routes/attendance");
const requestRoutes = require("./routes/requests");
const pool = require("./db/pool");

const app = express();
app.set("trust proxy", 1); // correct client IPs behind reverse proxies (needed for rate limiting)
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(globalLimiter);
// CORS: CORS_ORIGIN may be a comma-separated allowlist (exact origins).
// Local dev origins (localhost / 127.0.0.1 / [::1], any port, http|https) are
// always allowed so opening the client via 127.0.0.1 or another port doesn't
// fail the browser check. When CORS_ORIGIN is unset we keep "*" (allow all).
const corsAllowlist = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const LOCAL_ORIGIN_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / curl / server-to-server
      if (corsAllowlist.includes("*")) return cb(null, "*");
      if (corsAllowlist.includes(origin) || LOCAL_ORIGIN_RE.test(origin)) {
        return cb(null, origin);
      }
      return cb(null, false); // disallowed origin → browser blocks (as intended)
    },
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(attachUser);

// Health check — verifies DB connectivity
app.get("/api/health", async (_req, res) => {
  try {
    const { rows } = await pool.query("select now() as db_time");
    res.json({ status: "ok", db_time: rows[0].db_time });
  } catch (err) {
    res.status(500).json({ status: "degraded", error: err.message });
  }
});

// ---- Domain routes ----
// BOLA note: teachers see only their class, parents only their children,
// principals see all. Reads require authentication.
/** GET /api/classes — class list for pickers (all roles may read per RLS) */
app.get("/api/classes", requireRole("teacher", "principal", "parent"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `select c.id, c.name, u.full_name as teacher_name
       from public.classes c left join public.users u on u.id = c.teacher_id
       order by c.name`
    );
    res.json(rows);
  } catch (err) {
    console.error("[classes] query failed:", err.message);
    res.status(500).json({ error: "Failed to load classes" });
  }
});

app.get("/api/students", requireRole("teacher", "principal", "parent"), async (req, res) => {
  const params = [];
  let where = "";
  if (req.user.role === "teacher") {
    params.push(req.user.id);
    where = "where c.teacher_id = $1";
  } else if (req.user.role === "parent") {
    params.push(req.user.email);
    where = "where s.parent_email = $1";
  }
  try {
    const { rows } = await pool.query(
      `select s.id, s.roll_no, s.full_name, c.name as class_name,
              s.parent_email, pu.full_name as parent_name
       from public.students s
       left join public.classes c on c.id = s.class_id
       left join public.users pu on pu.email = s.parent_email and pu.role = 'parent'
       ${where} order by s.roll_no`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("[students] query failed:", err.message);
    res.status(500).json({ error: "Failed to load students" });
  }
});

/** POST /api/students — principal creates a student (Manage Users → Add Student) */
app.post("/api/students", writeLimiter, requireRole("principal"), async (req, res) => {
  const { rollNo, fullName, classId, parentEmail } = req.body || {};
  if (typeof rollNo !== "string" || !rollNo.trim() || rollNo.trim().length > 50) {
    return res.status(400).json({ error: "rollNo is required (max 50 chars)" });
  }
  if (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 100) {
    return res.status(400).json({ error: "fullName is required (max 100 chars)" });
  }
  if (classId && !UUID_RE.test(classId)) {
    return res.status(400).json({ error: "Invalid class id" });
  }
  if (parentEmail && (typeof parentEmail !== "string" || !EMAIL_RE.test(parentEmail))) {
    return res.status(400).json({ error: "parentEmail must be a valid email" });
  }
  try {
    const { rows } = await pool.query(
      `with ins as (
         insert into public.students (roll_no, full_name, class_id, parent_email)
         values ($1, $2, $3, $4)
         returning *
       )
       select i.id, i.roll_no, i.full_name, c.name as class_name, i.parent_email, i.created_at
       from ins i left join public.classes c on c.id = i.class_id`,
      [
        rollNo.trim(),
        fullName.trim(),
        classId || null,
        parentEmail ? parentEmail.trim().toLowerCase() : null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Roll number already exists" });
    if (err.code === "23503") return res.status(400).json({ error: "Unknown class id" });
    console.error("[students] create failed:", err.message);
    res.status(500).json({ error: "Failed to create student" });
  }
});

app.get("/api/marks", requireRole("teacher", "principal", "parent"), async (req, res) => {
  const params = [];
  let where = "";
  if (req.user.role === "parent") {
    params.push(req.user.email);
    where = "where s.parent_email = $1";
  } else if (req.user.role === "teacher") {
    params.push(req.user.id);
    where = "where c.teacher_id = $1";
  }
  try {
    const { rows } = await pool.query(
      `select m.*, s.roll_no, s.full_name
       from public.marks m
       join public.students s on s.id = m.student_id
       left join public.classes c on c.id = s.class_id
       ${where}
       order by s.roll_no, m.subject`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("[marks] query failed:", err.message);
    res.status(500).json({ error: "Failed to load marks" });
  }
});

/** POST /api/marks — teacher/principal enters marks (class-scoped for teachers) */
app.post("/api/marks", writeLimiter, requireRole("teacher", "principal"), async (req, res) => {
  const { studentId, subject, examName, score, maxScore } = req.body || {};
  if (!studentId || !subject || !examName || score == null) {
    return res.status(400).json({ error: "studentId, subject, examName, score are required" });
  }
  if (typeof subject !== "string" || subject.length > 100 || typeof examName !== "string" || examName.length > 100) {
    return res.status(400).json({ error: "Invalid subject or exam name" });
  }
  // BOLA guard: teachers may only enter marks for students in their own class
  if (!(await ownsStudent(req.user, studentId))) {
    return res.status(403).json({ error: "Forbidden — student outside your class" });
  }
  try {
    const { rows } = await pool.query(
      `insert into public.marks (student_id, subject, exam_name, score, max_score, entered_by)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (student_id, subject, exam_name) do update
         set score = excluded.score, max_score = excluded.max_score, entered_by = excluded.entered_by
       returning *`,
      [studentId, subject, examName, score, maxScore || 100, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("[marks] save failed:", err.message);
    res.status(500).json({ error: "Failed to save mark" });
  }
});

app.use("/api/attendance", attendanceRoutes);
app.use("/api/requests", requestRoutes);

// 404 + error handlers
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error("[server] unhandled:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = Number(process.env.PORT || 4000);
// Export the app for supertest/Jest; only auto-listen when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✔ Academic ERP API listening on http://localhost:${PORT}`);
    console.log(`  DB: ${process.env.DATABASE_URL ? "configured" : "MISSING — set DATABASE_URL in server/.env"}`);
    console.log(`  SMTP: ${process.env.SMTP_USER ? "configured" : "not set — absence alerts log to console (dev mode)"}`);
  });
}

module.exports = app;
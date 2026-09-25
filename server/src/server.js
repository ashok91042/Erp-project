const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const { attachUser, requireRole } = require("./middleware/auth");
const { globalLimiter, writeLimiter } = require("./middleware/rateLimit");
const { ownsStudent } = require("./middleware/ownership");
const attendanceRoutes = require("./routes/attendance");
const requestRoutes = require("./routes/requests");
const pool = require("./db/pool");

const app = express();
app.set("trust proxy", 1); // correct client IPs behind reverse proxies (needed for rate limiting)
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(globalLimiter);
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
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
      `select s.id, s.roll_no, s.full_name, c.name as class_name
       from public.students s left join public.classes c on c.id = s.class_id
       ${where} order by s.roll_no`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("[students] query failed:", err.message);
    res.status(500).json({ error: "Failed to load students" });
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
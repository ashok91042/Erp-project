const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const { attachUser, requireRole, EMAIL_RE } = require("./middleware/auth");
const { globalLimiter, writeLimiter } = require("./middleware/rateLimit");
const { ownsStudent, UUID_RE } = require("./middleware/ownership");
const attendanceRoutes = require("./routes/attendance");
const requestRoutes = require("./routes/requests");
const authRoutes = require("./routes/auth");
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

/** GET /api/me — identity of the caller resolved from the DB (loginless demo). */
app.get("/api/me", requireRole("teacher", "principal", "parent"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      "select id, full_name, email, role from public.users where id = $1",
      [req.user.id]
    );
    res.json(rows[0] || { id: req.user.id, full_name: null, email: req.user.email, role: req.user.role });
  } catch (err) {
    console.error("[me] lookup failed:", err.message);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

// ---- Domain routes ----
// BOLA note: teachers see only their class, parents only their children,
// principals see all. Reads require authentication.
/**
 * GET /api/stats — role-scoped dashboard aggregates so every dashboard shows
 * real, updated data. Principal sees the whole institution, a teacher sees
 * only their classes, a parent only their children (same scoping as reads).
 */
app.get("/api/stats", requireRole("teacher", "principal", "parent"), async (req, res) => {
  const { role, id, email } = req.user;
  // Student-level scope: principal → all, teacher → own classes, parent → own children
  const studentWhere =
    role === "teacher" ? "c.teacher_id = $1" : role === "parent" ? "s.parent_email = $1" : "1=1";
  const scopeParams = role === "teacher" ? [id] : role === "parent" ? [email] : [];
  // Class-level scope (strength chart): same intent, expressed on the classes table
  const classWhere =
    role === "teacher"
      ? "c.teacher_id = $1"
      : role === "parent"
        ? "c.id in (select class_id from public.students where parent_email = $1 and class_id is not null)"
        : "1=1";
  try {
    const [
      meRes, studentsRes, teachersRes, classesRes,
      pendingRes, strengthRes, trendRes, marksRes, absencesRes,
    ] = await Promise.all([
      pool.query("select full_name from public.users where id = $1", [id]),
      pool.query(
        `select count(*)::int as students, count(distinct s.parent_email)::int as parents
         from public.students s left join public.classes c on c.id = s.class_id
         where ${studentWhere}`, scopeParams),
      pool.query(`select count(*)::int as teachers from public.users where role = 'teacher'`),
      role === "teacher"
        ? pool.query(`select count(*)::int as classes from public.classes where teacher_id = $1`, [id])
        : role === "parent"
          ? pool.query(
              `select count(distinct s.class_id)::int as classes
               from public.students s where s.parent_email = $1 and s.class_id is not null`, [email])
          : pool.query(`select count(*)::int as classes from public.classes`),
      role === "principal"
        ? pool.query(`select count(*)::int as pending from public.permission_requests where status = 'pending'`)
        : role === "teacher"
          ? pool.query(
              `select count(*)::int as pending from public.permission_requests
               where status = 'pending' and teacher_id = $1`, [id])
          : Promise.resolve({ rows: [{ pending: 0 }] }),
      pool.query(
        `select c.name, count(s.id)::int as count
         from public.classes c left join public.students s on s.class_id = c.id
         where ${classWhere}
         group by c.id, c.name order by count desc, c.name`, scopeParams),
      pool.query(
        `select to_char(a.att_date, 'YYYY-MM-DD') as date,
                round(100.0 * sum((case when a.fn_present then 1 else 0 end)
                                + (case when a.an_present then 1 else 0 end))
                      / nullif(2 * count(*), 0))::int as pct
         from public.attendance a
         join public.students s on s.id = a.student_id
         join public.classes c on c.id = s.class_id
         where a.att_date >= current_date - 6 and ${studentWhere}
         group by a.att_date order by a.att_date`, scopeParams),
      pool.query(
        `select count(*)::int as exams, count(distinct m.subject)::int as subjects,
                round(avg(m.score / nullif(m.max_score, 0) * 100))::int as avg_pct
         from public.marks m
         join public.students s on s.id = m.student_id
         join public.classes c on c.id = s.class_id
         where ${studentWhere}`, scopeParams),
      pool.query(
        `select s.full_name as student, to_char(a.att_date, 'YYYY-MM-DD') as date,
                case when not a.fn_present and not a.an_present then 'Full day'
                     when not a.fn_present then 'Forenoon' else 'Afternoon' end as session
         from public.attendance a
         join public.students s on s.id = a.student_id
         join public.classes c on c.id = s.class_id
         where (not a.fn_present or not a.an_present)
           and a.att_date >= current_date - 13 and ${studentWhere}
         order by a.att_date desc, s.roll_no limit 10`, scopeParams),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const trend = trendRes.rows;
    const todayTrend = trend.find((t) => t.date === today);
    res.json({
      role,
      me: { name: meRes.rows[0]?.full_name || null, email, role },
      students: studentsRes.rows[0].students,
      parents: studentsRes.rows[0].parents,
      teachers: teachersRes.rows[0].teachers,
      classes: classesRes.rows[0].classes,
      pendingRequests: pendingRes.rows[0].pending,
      classStrength: strengthRes.rows,
      attendanceTrend: trend,
      attendanceTodayPct: todayTrend ? todayTrend.pct : null,
      marks: marksRes.rows[0],
      absences: absencesRes.rows,
    });
  } catch (err) {
    console.error("[stats] query failed:", err.message);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

/** GET /api/classes — class list for pickers (scoped: teacher→own, parent→children's) */
app.get("/api/classes", requireRole("teacher", "principal", "parent"), async (req, res) => {
  const params = [];
  let where = "";
  if (req.user.role === "teacher") {
    params.push(req.user.id);
    where = "where c.teacher_id = $1";
  } else if (req.user.role === "parent") {
    params.push(req.user.email);
    where = "where c.id in (select class_id from public.students where parent_email = $1 and class_id is not null)";
  }
  try {
    const { rows } = await pool.query(
      `select c.id, c.name, u.full_name as teacher_name,
              (select count(*)::int from public.students s where s.class_id = c.id) as student_count
       from public.classes c left join public.users u on u.id = c.teacher_id
       ${where} order by c.name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("[classes] query failed:", err.message);
    res.status(500).json({ error: "Failed to load classes" });
  }
});

/**
 * GET /api/teachers — principal staff directory (each teacher with their
 * assigned classes and class strength).
 */
app.get("/api/teachers", requireRole("principal"), async (_req, res) => {
  try {
    const [users, classes] = await Promise.all([
      pool.query(
        `select id, full_name, email from public.users
         where role = 'teacher' order by full_name`
      ),
      pool.query(
        `select c.teacher_id, c.name,
                (select count(*)::int from public.students s where s.class_id = c.id) as student_count
         from public.classes c order by c.name`
      ),
    ]);
    const byId = new Map(
      users.rows.map((u) => [u.id, { id: u.id, name: u.full_name, email: u.email, classes: [], students: 0 }])
    );
    for (const c of classes.rows) {
      const t = byId.get(c.teacher_id);
      if (!t) continue;
      t.classes.push(c.name);
      t.students += c.student_count;
    }
    res.json([...byId.values()]);
  } catch (err) {
    console.error("[teachers] query failed:", err.message);
    res.status(500).json({ error: "Failed to load teachers" });
  }
});

/**
 * GET /api/parents — principal directory of parents linked to students
 * (name from users when the parent account exists; children/classes aggregated).
 */
app.get("/api/parents", requireRole("principal"), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `select s.parent_email as email,
              max(u.full_name) as name,
              count(*)::int as children,
              string_agg(s.full_name, ', ' order by s.roll_no) as child_names,
              string_agg(distinct coalesce(c.name, 'Unassigned'), ', '
                         order by coalesce(c.name, 'Unassigned')) as classes
       from public.students s
       left join public.users u on u.email = s.parent_email and u.role = 'parent'
       left join public.classes c on c.id = s.class_id
       where s.parent_email is not null
       group by s.parent_email
       order by name nulls last, s.parent_email`
    );
    res.json(rows);
  } catch (err) {
    console.error("[parents] query failed:", err.message);
    res.status(500).json({ error: "Failed to load parents" });
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

/** PATCH /api/students/:id — principal updates a student record. */
app.patch("/api/students/:id", writeLimiter, requireRole("principal"), async (req, res) => {
  const { fullName, classId, parentEmail } = req.body || {};
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid student id" });
  }
  if (fullName !== undefined && (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 100)) {
    return res.status(400).json({ error: "fullName must be 1-100 characters" });
  }
  if (classId !== undefined && classId !== null && classId !== "" && !UUID_RE.test(classId)) {
    return res.status(400).json({ error: "Invalid class id" });
  }
  if (parentEmail !== undefined && parentEmail !== null && parentEmail !== "" &&
      (typeof parentEmail !== "string" || !EMAIL_RE.test(parentEmail))) {
    return res.status(400).json({ error: "parentEmail must be a valid email" });
  }
  const sets = [];
  const params = [req.params.id];
  if (fullName !== undefined) { params.push(fullName.trim()); sets.push(`full_name = $${params.length}`); }
  if (classId !== undefined) {
    if (classId === null || classId === "") { sets.push("class_id = null"); }
    else { params.push(classId); sets.push(`class_id = $${params.length}`); }
  }
  if (parentEmail !== undefined) {
    if (parentEmail === null || parentEmail === "") { sets.push("parent_email = null"); }
    else { params.push(parentEmail.trim().toLowerCase()); sets.push(`parent_email = $${params.length}`); }
  }
  if (!sets.length) return res.status(400).json({ error: "No updatable fields provided" });
  try {
    const { rows } = await pool.query(
      `with upd as (
         update public.students set ${sets.join(", ")} where id = $1 returning *
       )
       select u.id, u.roll_no, u.full_name, u.parent_email, c.name as class_name
       from upd u left join public.classes c on c.id = u.class_id`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: "Student not found" });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === "23503") return res.status(400).json({ error: "Unknown class id" });
    console.error("[students] update failed:", err.message);
    res.status(500).json({ error: "Failed to update student" });
  }
});

/** DELETE /api/students/:id — principal removes a student (cascades marks/attendance). */
app.delete("/api/students/:id", writeLimiter, requireRole("principal"), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid student id" });
  }
  try {
    const { rows } = await pool.query("delete from public.students where id = $1 returning id", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Student not found" });
    res.json({ deleted: rows[0].id });
  } catch (err) {
    console.error("[students] delete failed:", err.message);
    res.status(500).json({ error: "Failed to delete student" });
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
app.use("/api/auth", authRoutes);

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
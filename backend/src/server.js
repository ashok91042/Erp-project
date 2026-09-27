const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
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

// Root route — lightweight service banner so hitting the bare host gives
// something useful instead of the 404 catch-all. Deliberately does not touch
// the DB: /api/health is the connectivity check.
app.get("/", (_req, res) => {
  res.json({
    service: "academic-erp-api",
    status: "ok",
    health: "/api/health",
    docs: "see backend/README.md for the endpoint list",
  });
});

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
        `select c.id, c.teacher_id, c.name,
                (select count(*)::int from public.students s where s.class_id = c.id) as student_count
         from public.classes c order by c.name`
      ),
    ]);
    const byId = new Map(
      users.rows.map((u) => [u.id, { id: u.id, name: u.full_name, email: u.email, classes: [], classIds: [], students: 0 }])
    );
    for (const c of classes.rows) {
      const t = byId.get(c.teacher_id);
      if (!t) continue;
      t.classes.push(c.name);
      t.classIds.push(c.id);
      t.students += c.student_count;
    }
    res.json([...byId.values()]);
  } catch (err) {
    console.error("[teachers] query failed:", err.message);
    res.status(500).json({ error: "Failed to load teachers" });
  }
});

/**
 * POST /api/teachers — principal adds a teacher account.
 * Creates the user with a bcrypt password hash and optionally assigns a class
 * (a class has a single teacher, so it is detached from any previous holder).
 */
app.post("/api/teachers", writeLimiter, requireRole("principal"), async (req, res) => {
  const { fullName, email, password, classId } = req.body || {};
  if (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 100) {
    return res.status(400).json({ error: "fullName is required (max 100 chars)" });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: "email must be a valid email" });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 200) {
    return res.status(400).json({ error: "password must be 8-200 characters" });
  }
  if (classId && !UUID_RE.test(classId)) {
    return res.status(400).json({ error: "Invalid class id" });
  }
  const client = await pool.connect();
  try {
    // Existence checks run before BEGIN so no early return can leave the
    // pooled connection holding an open transaction.
    if (classId) {
      const { rowCount } = await client.query("select 1 from public.classes where id = $1", [classId]);
      if (!rowCount) return res.status(400).json({ error: "Unknown class id" });
    }
    await client.query("BEGIN");
    const { rows } = await client.query(
      `insert into public.users (email, full_name, role, password_hash)
       values ($1, $2, 'teacher', $3)
       returning id, email, full_name, role`,
      [email.trim().toLowerCase(), fullName.trim(), await bcrypt.hash(password, 10)]
    );
    const teacher = rows[0];
    if (classId) {
      await client.query("update public.classes set teacher_id = $1 where id = $2", [teacher.id, classId]);
    }
    await client.query("COMMIT");
    res.status(201).json(teacher);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") return res.status(409).json({ error: "Email already exists" });
    console.error("[teachers] create failed:", err.message);
    res.status(500).json({ error: "Failed to create teacher" });
  } finally {
    client.release();
  }
});

/** PATCH /api/teachers/:id — principal renames a teacher and/or reassigns their class. */
app.patch("/api/teachers/:id", writeLimiter, requireRole("principal"), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid teacher id" });
  }
  const { fullName, classId } = req.body || {};
  if (fullName !== undefined && (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 100)) {
    return res.status(400).json({ error: "fullName must be 1-100 characters" });
  }
  if (classId !== undefined && classId !== null && classId !== "" && !UUID_RE.test(classId)) {
    return res.status(400).json({ error: "Invalid class id" });
  }
  if (fullName === undefined && classId === undefined) {
    return res.status(400).json({ error: "No updatable fields provided" });
  }
  const client = await pool.connect();
  try {
    // Existence checks run before BEGIN so no early return can leave the
    // pooled connection holding an open transaction.
    const { rowCount: found } = await client.query(
      "select 1 from public.users where id = $1 and role = 'teacher'", [req.params.id]
    );
    if (!found) return res.status(404).json({ error: "Teacher not found" });
    if (classId) {
      const { rowCount } = await client.query("select 1 from public.classes where id = $1", [classId]);
      if (!rowCount) return res.status(400).json({ error: "Unknown class id" });
    }
    await client.query("BEGIN");
    const sets = [];
    const params = [req.params.id];
    if (fullName !== undefined) { params.push(fullName.trim()); sets.push(`full_name = $${params.length}`); }
    if (sets.length) {
      await client.query(
        `update public.users set ${sets.join(", ")} where id = $1 and role = 'teacher'`, params
      );
    }
    if (classId !== undefined) {
      if (classId === null || classId === "") {
        await client.query("update public.classes set teacher_id = null where teacher_id = $1", [req.params.id]);
      } else {
        await client.query("update public.classes set teacher_id = $1 where id = $2", [req.params.id, classId]);
        // This UI assigns a single class per teacher, so drop any others they held.
        await client.query(
          "update public.classes set teacher_id = null where teacher_id = $1 and id <> $2",
          [req.params.id, classId]
        );
      }
    }
    await client.query("COMMIT");
    const { rows } = await client.query(
      "select id, email, full_name, role from public.users where id = $1", [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[teachers] update failed:", err.message);
    res.status(500).json({ error: "Failed to update teacher" });
  } finally {
    client.release();
  }
});

/** DELETE /api/teachers/:id — principal removes a teacher (their classes are unassigned). */
app.delete("/api/teachers/:id", writeLimiter, requireRole("principal"), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid teacher id" });
  }
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "You cannot remove your own account" });
  }
  try {
    const { rows } = await pool.query(
      "delete from public.users where id = $1 and role = 'teacher' returning id", [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Teacher not found" });
    res.json({ deleted: rows[0].id });
  } catch (err) {
    console.error("[teachers] delete failed:", err.message);
    res.status(500).json({ error: "Failed to delete teacher" });
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
              u.id,
              u.full_name as name,
              count(*)::int as children,
              string_agg(s.full_name, ', ' order by s.roll_no) as child_names,
              array_agg(s.id) as student_ids,
              string_agg(distinct coalesce(c.name, 'Unassigned'), ', '
                         order by coalesce(c.name, 'Unassigned')) as classes
       from public.students s
       left join public.users u on u.email = s.parent_email and u.role = 'parent'
       left join public.classes c on c.id = s.class_id
       where s.parent_email is not null
       group by s.parent_email, u.id, u.full_name
       order by name nulls last, s.parent_email`
    );
    res.json(rows);
  } catch (err) {
    console.error("[parents] query failed:", err.message);
    res.status(500).json({ error: "Failed to load parents" });
  }
});

/**
 * Normalises a studentIds payload into a validated uuid[] list.
 * Returns { error } when the shape is malformed.
 */
function parseStudentIds(raw) {
  if (raw === undefined || raw === null) return { ids: [] };
  if (!Array.isArray(raw)) return { error: "studentIds must be an array" };
  if (raw.length > 200) return { error: "Too many students linked at once (max 200)" };
  const ids = raw.map((v) => (typeof v === "string" ? v.trim() : v));
  if (ids.some((v) => typeof v !== "string" || !UUID_RE.test(v))) {
    return { error: "studentIds must contain valid student ids" };
  }
  return { ids };
}

/**
 * POST /api/parents — principal adds a parent contact with a login account and
 * links their children. Children are identified by `students.parent_email`, so
 * selecting a child who already has a parent moves them to this one.
 */
app.post("/api/parents", writeLimiter, requireRole("principal"), async (req, res) => {
  const { fullName, email, password } = req.body || {};
  const { ids, error: idsError } = parseStudentIds(req.body?.studentIds);
  if (idsError) return res.status(400).json({ error: idsError });
  if (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 100) {
    return res.status(400).json({ error: "fullName is required (max 100 chars)" });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: "email must be a valid email" });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 200) {
    return res.status(400).json({ error: "password must be 8-200 characters" });
  }
  const client = await pool.connect();
  try {
    // Existence checks run before BEGIN so no early return can leave the
    // pooled connection holding an open transaction.
    if (ids.length) {
      const { rows } = await client.query("select id from public.students where id = any($1::uuid[])", [ids]);
      if (rows.length !== ids.length) return res.status(400).json({ error: "One or more students not found" });
    }
    await client.query("BEGIN");
    const { rows } = await client.query(
      `insert into public.users (email, full_name, role, password_hash)
       values ($1, $2, 'parent', $3)
       returning id, email, full_name, role`,
      [email.trim().toLowerCase(), fullName.trim(), await bcrypt.hash(password, 10)]
    );
    const parent = rows[0];
    if (ids.length) {
      await client.query("update public.students set parent_email = $1 where id = any($2::uuid[])", [parent.email, ids]);
    }
    await client.query("COMMIT");
    res.status(201).json({ ...parent, studentIds: ids });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") return res.status(409).json({ error: "Email already exists" });
    console.error("[parents] create failed:", err.message);
    res.status(500).json({ error: "Failed to create parent" });
  } finally {
    client.release();
  }
});
/** PATCH /api/parents/:email — principal renames a parent and/or changes their children. */
app.patch("/api/parents/:email", writeLimiter, requireRole("principal"), async (req, res) => {
  const email = String(req.params.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Invalid parent email" });
  const { fullName } = req.body || {};
  const providedIds = req.body?.studentIds !== undefined;
  const { ids, error: idsError } = parseStudentIds(req.body?.studentIds);
  if (idsError) return res.status(400).json({ error: idsError });
  if (fullName !== undefined && (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 100)) {
    return res.status(400).json({ error: "fullName must be 1-100 characters" });
  }
  if (fullName === undefined && !providedIds) {
    return res.status(400).json({ error: "No updatable fields provided" });
  }
  const client = await pool.connect();
  try {
    const { rowCount: found } = await client.query(
      "select 1 from public.users where email = $1 and role = 'parent'", [email]
    );
    if (!found) return res.status(404).json({ error: "Parent account not found" });
    if (ids.length) {
      const { rows } = await client.query("select id from public.students where id = any($1::uuid[])", [ids]);
      if (rows.length !== ids.length) return res.status(400).json({ error: "One or more students not found" });
    }
    await client.query("BEGIN");
    if (fullName !== undefined) {
      await client.query("update public.users set full_name = $1 where email = $2 and role = 'parent'", [fullName.trim(), email]);
    }
    if (providedIds) {
      // Release children linked to this parent who are no longer selected…
      await client.query(
        "update public.students set parent_email = null where parent_email = $1 and not (id = any($2::uuid[]))",
        [email, ids]
      );
      // …and move every selected child onto this parent.
      await client.query("update public.students set parent_email = $1 where id = any($2::uuid[])", [email, ids]);
    }
    await client.query("COMMIT");
    const { rows } = await client.query("select id, email, full_name, role from public.users where email = $1", [email]);
    res.json({ ...rows[0], studentIds: ids });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[parents] update failed:", err.message);
    res.status(500).json({ error: "Failed to update parent" });
  } finally {
    client.release();
  }
});
/** DELETE /api/parents/:email — principal removes a parent; children become unlinked. */
app.delete("/api/parents/:email", writeLimiter, requireRole("principal"), async (req, res) => {
  const email = String(req.params.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Invalid parent email" });
  if (email === String(req.user.email || "").toLowerCase()) {
    return res.status(400).json({ error: "You cannot remove your own account" });
  }
  const client = await pool.connect();
  try {
    const { rowCount: found } = await client.query(
      "select 1 from public.users where email = $1 and role = 'parent'", [email]
    );
    if (!found) return res.status(404).json({ error: "Parent account not found" });
    await client.query("BEGIN");
    // Children keep no dangling contact: unlink them from this parent.
    await client.query("update public.students set parent_email = null where parent_email = $1", [email]);
    const { rowCount } = await client.query(
      "delete from public.users where email = $1 and role = 'parent'", [email]
    );
    await client.query("COMMIT");
    if (!rowCount) return res.status(404).json({ error: "Parent account not found" });
    res.json({ deleted: email });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[parents] delete failed:", err.message);
    res.status(500).json({ error: "Failed to delete parent" });
  } finally {
    client.release();
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
// Listen unless Jest is driving the process, so both `node src/server.js` and
// Vercel bind the port. `require.main === module` is NOT sufficient on its own:
// Vercel's Node runtime *imports* the entrypoint instead of running it as main,
// so require.main is never this module and the server would never start (every
// request would hang until the function timed out). tests/helpers.js sets
// NODE_ENV=test before requiring this file, so supertest still gets the bare
// app with no listener.
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`✔ Academic ERP API listening on http://localhost:${PORT}`);
    console.log(`  DB: ${process.env.DATABASE_URL ? "configured" : "MISSING — set DATABASE_URL in server/.env"}`);
    console.log(`  SMTP: ${process.env.SMTP_USER ? "configured" : "not set — absence alerts log to console (dev mode)"}`);
  });
}

module.exports = app;
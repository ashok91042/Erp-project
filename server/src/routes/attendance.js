const express = require("express");
const pool = require("../db/pool");
const { requireRole } = require("../middleware/auth");
const { assertBatchOwnership, UUID_RE } = require("../middleware/ownership");
const { writeLimiter } = require("../middleware/rateLimit");
const { sendAbsenceAlert } = require("../mailer");

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/attendance
 * Body: { records: [{ studentId, fnPresent, anPresent, remarks }], date }
 * Upserts attendance for a date; triggers email alerts for FN/AN absences.
 * BOLA: teachers may only submit records for students in their own class —
 * a batch containing any foreign student is rejected in full (403).
 */
router.post("/", writeLimiter, requireRole("teacher", "principal"), async (req, res) => {
  const { records, date } = req.body || {};
  if (!Array.isArray(records) || records.length === 0 || !date) {
    return res.status(400).json({ error: "records[] and date are required" });
  }
  if (!DATE_RE.test(String(date))) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }
  if (records.length > 200) {
    return res.status(400).json({ error: "Too many records in one batch (max 200)" });
  }

  try {
    await assertBatchOwnership(req.user, records.map((r) => r && r.studentId));
  } catch (e) {
    return res.status(e.status || 403).json({ error: e.message });
  }

  const client = await pool.connect();
  const results = [];
  try {
    await client.query("begin");
    for (const r of records) {
      const { rows } = await client.query(
        `insert into public.attendance (student_id, class_id, att_date, fn_present, an_present, remarks, marked_by)
         values ($1, (select class_id from public.students where id = $1), $2, $3, $4, $5, $6)
         on conflict (student_id, att_date) do update
           set fn_present = excluded.fn_present,
               an_present = excluded.an_present,
               remarks    = excluded.remarks,
               marked_by  = excluded.marked_by
         returning *, (select roll_no || '|' || full_name || '|' || coalesce(parent_email,'') from public.students s where s.id = attendance.student_id) as student_info`,
        [r.studentId, date, r.fnPresent !== false, r.anPresent !== false, String(r.remarks || "-").slice(0, 300), req.user.id]
      );
      const row = rows[0];
      const [rollNo, name, parentEmail] = (row.student_info || "").split("|");
      const session = !row.fn_present && !row.an_present ? "both" : !row.fn_present ? "fn" : !row.an_present ? "an" : null;
      results.push({ studentId: r.studentId, rollNo, name, parentEmail, absence: session });
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    console.error("[attendance] save failed:", err.message);
    return res.status(500).json({ error: "Failed to save attendance" });
  } finally {
    client.release();
  }

  // Fire email notifications for absentees (non-blocking, after response)
  const absentees = results.filter((r) => r.absence);
  res.json({ saved: results.length, absentees: absentees.length, notifications: [] });

  for (const a of absentees) {
    try {
      const result = await sendAbsenceAlert({
        studentName: a.name, rollNo: a.rollNo, date, session: a.absence, parentEmail: a.parentEmail,
      });
      await pool.query("update public.attendance set notified = true where student_id = $1 and att_date = $2", [a.studentId, date]);
      a.notified = result.sent || result.dev || false;
    } catch (e) {
      console.error("[attendance] notify failed:", e.message);
      a.notified = false;
    }
  }
});

/** GET /api/attendance?date=YYYY-MM-DD — roster with attendance (auth-scoped) */
router.get("/", requireRole("teacher", "principal", "parent"), async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(String(date))) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }
  const params = [date];
  let extra = "";
  if (req.user.role === "teacher") {
    params.push(req.user.id);
    extra = "and c.teacher_id = $2";
  } else if (req.user.role === "parent") {
    params.push(req.user.email);
    extra = "and s.parent_email = $2";
  }
  try {
    const { rows } = await pool.query(
      `select s.id, s.roll_no, s.full_name, c.name as class_name,
              coalesce(a.fn_present, true) as fn_present,
              coalesce(a.an_present, true) as an_present,
              coalesce(a.remarks, '-')     as remarks,
              coalesce(a.notified, false)  as notified
       from public.students s
       join public.classes c on c.id = s.class_id
       left join public.attendance a on a.student_id = s.id and a.att_date = $1
       where 1=1 ${extra}
       order by s.roll_no`,
      params
    );
    res.json({ date, rows });
  } catch (err) {
    console.error("[attendance] query failed:", err.message);
    res.status(500).json({ error: "Failed to load attendance" });
  }
});

module.exports = router;
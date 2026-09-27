/**
 * Object-level authorization (BOLA/IDOR) guards.
 * The API is the authorization boundary: DB connections run as a privileged
 * role that bypasses RLS, so every student-scoped operation must be checked
 * against the authenticated user here.
 */
const pool = require("../db/pool");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when user may act on this single student (principal: always). */
async function ownsStudent(user, studentId) {
  if (!user) return false;
  if (user.role === "principal") return true;
  if (user.role !== "teacher") return false; // parents never write
  if (!UUID_RE.test(String(studentId || ""))) return false;
  const { rows } = await pool.query(
    `select 1 from public.students s join public.classes c on c.id = s.class_id
     where s.id = $1 and c.teacher_id = $2 limit 1`,
    [studentId, user.id]
  );
  return rows.length > 0;
}

/**
 * Batch guard for attendance: reject the whole batch when ANY *existing*
 * student is outside the teacher's class. Unknown ids are left to hit the FK
 * inside the transaction so atomicity/rollback semantics remain testable.
 */
async function assertBatchOwnership(user, studentIds) {
  if (!user) {
    const err = new Error("Authentication required");
    err.status = 401;
    throw err;
  }
  if (user.role === "principal") return;
  if (user.role !== "teacher") {
    const err = new Error("Forbidden — teachers only");
    err.status = 403;
    throw err;
  }
  const valid = studentIds.filter((id) => UUID_RE.test(String(id || "")));
  if (valid.length === 0) return;
  const { rows } = await pool.query(
    `select s.id, (c.teacher_id = $2) as owned
     from public.students s left join public.classes c on c.id = s.class_id
     where s.id = any($1::uuid[])`,
    [valid, user.id]
  );
  if (rows.some((r) => r.owned === false)) {
    const err = new Error("Forbidden — student outside your class");
    err.status = 403;
    throw err;
  }
}

module.exports = { UUID_RE, ownsStudent, assertBatchOwnership };
// Shared test helpers: app instance, DB pool access, seeded account headers,
// and test-data fixtures that clean up after themselves.
process.env.NODE_ENV = "test";
process.env.PORT = "0"; // unused: supertest binds its own ephemeral port
// The suites authenticate with the seeded demo accounts via the x-demo-email
// header (TEACHER/PRINCIPAL/PARENT below) rather than logging in each time.
// backend/.env ships ALLOW_DEMO_HEADERS=false, and dotenv never overrides a
// variable that is already set, so force it on here — otherwise every
// demo-header suite gets 401 and the run looks like a real regression.
// Set before requiring the app (which calls dotenv.config()).
process.env.ALLOW_DEMO_HEADERS = "true";

const request = require("supertest");

// The app is created by requiring src/server (it also starts .listen on PORT,
// which is fine — supertest talks to the app object directly).
const app = require("../src/server");
const pool = require("../src/db/pool");

// The teacher identity is resolved from the data in tests/globalSetup.js
// (whoever currently owns a class that has students), so reassigning a class
// between teachers cannot silently break the teacher-scoped suites.
const TEACHER_EMAIL = process.env.TEST_TEACHER_EMAIL || "lakshmi@school.edu";

const TEACHER = { "x-demo-email": TEACHER_EMAIL, "x-demo-role": "teacher" };
const PRINCIPAL = { "x-demo-email": "principal@school.edu", "x-demo-role": "principal" };
const PARENT = { "x-demo-email": "parent.demo@mail.com", "x-demo-role": "parent" };

const uniqueTag = () => `jest_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

/**
 * A class owned by the resolved teacher, so teacher-scoped reads and the
 * ownership (BOLA) checks both work. Falls back to any class with students.
 */
async function teacherClassId() {
  const { rows } = await pool.query(
    `select c.id
       from public.classes c
       join public.users u on u.id = c.teacher_id
      where u.email = $1
      order by (select count(*) from public.students s where s.class_id = c.id) desc, c.name
      limit 1`,
    [TEACHER_EMAIL]
  );
  if (rows.length) return rows[0].id;
  const any = await pool.query("select id from public.classes limit 1");
  if (!any.rows.length) throw new Error("globalSetup: no classes exist — run `npm run db:init`");
  return any.rows[0].id;
}

/** Roster of the class the resolved teacher owns (so it is never empty). */
async function getStudents() {
  const classId = await teacherClassId();
  const { rows } = await pool.query(
    `select s.id, s.roll_no, s.full_name, s.class_id, s.parent_email
       from public.students s where s.class_id = $1 order by s.roll_no`,
    [classId]
  );
  return rows;
}

/**
 * Creates a temporary student in the resolved teacher's class (and returns a
 * cleanup fn) so tests never mutate the shared demo rows destructively.
 */
async function createTempStudent(rollSuffix) {
  const tag = uniqueTag();
  const classId = await teacherClassId();
  const { rows } = await pool.query(
    `insert into public.students (roll_no, full_name, class_id, parent_email)
     values ($1, $2, $3, 'jest-cleanup@mail.com')
     returning id, roll_no, full_name, class_id`,
    [`TEST-${rollSuffix}-${tag}`, `Test Student ${rollSuffix}`, classId]
  );
  const student = rows[0];
  const cleanup = () => pool.query("delete from public.students where id = $1", [student.id]);
  return { student, cleanup };
}

/** Delete every attendance/rows/marks/request touched by a test run (by marker) */
async function cleanupByRoll(rollNo) {
  await pool.query(
    `delete from public.attendance where student_id in (select id from public.students where roll_no = $1)`,
    [rollNo]
  );
  await pool.query(
    `delete from public.marks where student_id in (select id from public.students where roll_no = $1)`,
    [rollNo]
  );
  await pool.query("delete from public.students where roll_no = $1", [rollNo]);
}

async function cleanupRequestsByTitle(title) {
  await pool.query("delete from public.permission_requests where title = $1", [title]);
}

module.exports = { request, app, pool, TEACHER, TEACHER_EMAIL, PRINCIPAL, PARENT, uniqueTag, getStudents, createTempStudent, teacherClassId, cleanupByRoll, cleanupRequestsByTitle };
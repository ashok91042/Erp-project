// Shared test helpers: app instance, DB pool access, seeded account headers,
// and test-data fixtures that clean up after themselves.
process.env.NODE_ENV = "test";
process.env.PORT = "0"; // unused: supertest binds its own ephemeral port

const request = require("supertest");

// The app is created by requiring src/server (it also starts .listen on PORT,
// which is fine — supertest talks to the app object directly).
const app = require("../src/server");
const pool = require("../src/db/pool");

const TEACHER = { "x-demo-email": "lakshmi@school.edu", "x-demo-role": "teacher" };
const PRINCIPAL = { "x-demo-email": "principal@school.edu", "x-demo-role": "principal" };
const PARENT = { "x-demo-email": "parent.demo@mail.com", "x-demo-role": "parent" };

const uniqueTag = () => `jest_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

/** Fetch the seeded Class 10A roster (authenticated as the demo teacher) */
async function getStudents() {
  const res = await request(app).get("/api/students").set(TEACHER).expect(200);
  return res.body;
}

/**
 * Creates a temporary student (and returns cleanup fn) so tests never mutate
 * the shared demo rows destructively.
 */
async function createTempStudent(rollSuffix) {
  const tag = uniqueTag();
  const { rows } = await pool.query(
    `insert into public.students (roll_no, full_name, class_id, parent_email)
     select $1, $2, c.id, 'jest-cleanup@mail.com'
     from public.classes c where c.name = 'Class 10A'
     returning id, roll_no, full_name`,
    [`TEST-${rollSuffix}-${tag}`, `Test Student ${rollSuffix}`]
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

module.exports = { request, app, pool, TEACHER, PRINCIPAL, PARENT, uniqueTag, getStudents, createTempStudent, cleanupByRoll, cleanupRequestsByTitle };
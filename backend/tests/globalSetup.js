/**
 * Resolves which teacher the suites should act as, BEFORE any test file loads.
 *
 * The suites used to hard-code lakshmi@school.edu, which silently broke the
 * moment Class 10A was assigned to a different teacher: she then owned no
 * class, so the teacher-scoped reads returned nothing and ownership checks
 * rejected writes. Picking the teacher from the data instead keeps the suites
 * correct no matter who currently owns a class.
 *
 * Preference order: the original demo teacher if she still owns a class,
 * otherwise any teacher who owns a class containing students.
 */
require("dotenv").config();
const { Pool } = require("pg");

const PREFERRED_EMAIL = "lakshmi@school.edu";

module.exports = async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `select u.email, u.full_name
         from public.users u
         join public.classes c on c.teacher_id = u.id
         join public.students s on s.class_id = c.id
        where u.role = 'teacher'
        group by u.email, u.full_name
       having count(s.id) > 0
        order by (u.email = $1) desc, u.full_name`,
      [PREFERRED_EMAIL]
    );

    if (rows.length) {
      process.env.TEST_TEACHER_EMAIL = rows[0].email;
      process.env.TEST_TEACHER_NAME = rows[0].full_name;
      console.log(`[setup] teacher identity -> ${rows[0].email} (${rows[0].full_name})`);
    } else {
      // Leave the fallback in helpers.js, but make the cause obvious.
      process.env.TEST_TEACHER_EMAIL = PREFERRED_EMAIL;
      console.warn(
        "[setup] WARNING: no teacher owns a class with students; " +
          "teacher-scoped suites will fail until a class is assigned."
      );
    }
  } catch (err) {
    process.env.TEST_TEACHER_EMAIL = PREFERRED_EMAIL;
    console.error("[setup] could not resolve teacher identity:", err.message);
  } finally {
    await pool.end();
  }
};
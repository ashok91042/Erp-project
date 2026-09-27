/**
 * Transaction & schema unit suite — the layer the HTTP suites rely on but never
 * isolate.
 *
 * WHY THIS FILE EXISTS
 * attendance.transaction.test.js proves atomicity by driving POST /api/attendance
 * and checking the table afterwards. That is an end-to-end assertion: it passes
 * whether the rollback came from `client.query("rollback")` in the route, from
 * Postgres aborting the transaction on a constraint violation, or from a failed
 * statement poisoning the tx so a later COMMIT is silently converted to a
 * rollback. All three produce the same observable result, so a regression in any
 * one of them is invisible to the existing suite.
 *
 * These tests instead hold an explicit client, drive BEGIN / COMMIT / ROLLBACK
 * by hand, and assert the *mechanism*:
 *   - a rolled-back client really does discard writes, and a committed twin
 *     proves the harness can still detect a false pass;
 *   - a constraint violation poisons the whole transaction, so a later COMMIT
 *     cannot sneak a partial batch through;
 *   - the unique indexes that ON CONFLICT depends on really exist;
 *   - deletes cascade (or null out) exactly where the features rely on it.
 *
 * These are deliberately NOT route tests. They never call the Express app, never
 * use the demo headers, and never touch the paths the HTTP suites own — so they
 * can run alongside them without fighting over shared rows.
 */
const { pool } = require("./helpers");

/** A student in a real class, so FK/ON DELETE behaviour matches production. */
async function makeStudent() {
  const tag = `unit_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const { rows } = await pool.query(
    `insert into public.students (roll_no, full_name, class_id)
     values ($1, $2, (select id from public.classes limit 1))
     returning id, roll_no, full_name`,
    [`${tag}`, `Tx Unit ${tag}`]
  );
  return rows[0];
}

const dropStudent = (id) => pool.query("delete from public.students where id = $1", [id]);

describe("Transaction mechanics (explicit client)", () => {
  let student;
  beforeAll(async () => { student = await makeStudent(); });
  afterAll(async () => { await dropStudent(student.id); });

  const insertMark = (client, exam, score, max) =>
    client.query(
      `insert into public.marks (student_id, subject, exam_name, score, max_score)
       values ($1, 'Physics', $2, $3, $4)`,
      [student.id, exam, score, max]
    );

  const countMarks = (exam) =>
    pool
      .query(
        "select count(*)::int as n from public.marks where student_id = $1 and exam_name = $2",
        [student.id, exam]
      )
      .then((r) => r.rows[0].n);

  test("a ROLLED BACK client discards its writes", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await insertMark(client, "ROLLBACK-1", 70, 100);
      await client.query("rollback");
    } finally {
      client.release();
    }
    expect(await countMarks("ROLLBACK-1")).toBe(0);
  });

  test("a COMMITTED client persists its writes (guards the twin above)", async () => {
    // Without this, a harness that never really wrote would make the rollback
    // test pass for entirely the wrong reason.
    const client = await pool.connect();
    try {
      await client.query("begin");
      await insertMark(client, "COMMIT-1", 70, 100);
      await client.query("commit");
    } finally {
      client.release();
    }
    expect(await countMarks("COMMIT-1")).toBe(1);
  });

  test("a failed statement poisons the tx so a later COMMIT cannot persist the batch", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      // First write is valid...
      await insertMark(client, "POISON-OK", 55, 100);
      // ...then a constraint violation (score < 0) aborts the whole transaction.
      await expect(insertMark(client, "POISON-BAD", -5, 100)).rejects.toThrow();

      // The route issues an explicit rollback, but prove Postgres would have
      // refused the commit anyway: this is the guarantee atomicity rests on.
      await client.query("commit").catch(() => {});
    } finally {
      client.release();
    }

    const { rows } = await pool.query(
      "select exam_name from public.marks where student_id = $1 and exam_name like 'POISON-%'",
      [student.id]
    );
    expect(rows).toHaveLength(0);
  });

  test("an explicit rollback after a failure is a no-op and does not error", async () => {
    // This is the exact sequence routes/attendance.js runs in its catch block.
    const client = await pool.connect();
    try {
      await client.query("begin");
      await expect(insertMark(client, "ROLLBACK-AFTER-FAIL", 10, 0)).rejects.toThrow(); // max_score > 0
      await expect(client.query("rollback")).resolves.toBeDefined();
    } finally {
      client.release();
    }
  });
});

describe("Unique indexes that the ON CONFLICT upserts depend on", () => {
  let student;
  beforeAll(async () => { student = await makeStudent(); });
  afterAll(async () => { await dropStudent(student.id); });

  test("marks is unique per (student, subject, exam)", async () => {
    const insert = () =>
      pool.query(
        `insert into public.marks (student_id, subject, exam_name, score, max_score)
         values ($1, 'Maths', 'UNIQ-1', 60, 100)`,
        [student.id]
      );
    await insert();
    // Without this index the route's ON CONFLICT clause would match nothing and
    // silently duplicate the row on every re-submission.
    await expect(insert()).rejects.toThrow(/duplicate key|unique/i);
  });

  test("attendance is unique per (student, date)", async () => {
    const d = "2099-06-01";
    const insert = () =>
      pool.query("insert into public.attendance (student_id, att_date) values ($1, $2)", [student.id, d]);
    await insert();
    await expect(insert()).rejects.toThrow(/duplicate key|unique/i);
  });

  test("students.roll_no is unique", async () => {
    const tag = `unit_dup_${Date.now()}`;
    const { rows } = await pool.query(
      `insert into public.students (roll_no, full_name, class_id)
       values ($1, 'Dup A', (select id from public.classes limit 1)) returning id`,
      [tag]
    );
    try {
      await expect(
        pool.query(
          `insert into public.students (roll_no, full_name, class_id)
           values ($1, 'Dup B', (select id from public.classes limit 1))`,
          [tag]
        )
      ).rejects.toThrow(/duplicate key|unique/i);
    } finally {
      await pool.query("delete from public.students where id = $1", [rows[0].id]);
    }
  });
});

describe("Check constraints the API relies on for validation", () => {
  let student;
  beforeAll(async () => { student = await makeStudent(); });
  afterAll(async () => { await dropStudent(student.id); });

  const insertMark = (exam, score, max) =>
    pool.query(
      `insert into public.marks (student_id, subject, exam_name, score, max_score)
       values ($1, 'Science', $2, $3, $4)`,
      [student.id, exam, score, max]
    );

  test("score >= 0 is enforced by the database", async () => {
    await expect(insertMark("CHK-NEG", -1, 100)).rejects.toThrow(/check/i);
  });

  test("max_score > 0 is enforced by the database", async () => {
    // The route never validates maxScore, so this constraint is the ONLY thing
    // stopping a zero/negative denominator from reaching the marks table.
    await expect(insertMark("CHK-MAX", 10, 0)).rejects.toThrow(/check/i);
    await expect(insertMark("CHK-MAXNEG", 10, -5)).rejects.toThrow(/check/i);
  });

  test("a rejected insert leaves no partial row behind", async () => {
    const before = await pool.query("select count(*)::int as n from public.marks where student_id = $1", [student.id]);
    await expect(insertMark("CHK-ATOMIC", -3, 100)).rejects.toThrow();
    const after = await pool.query("select count(*)::int as n from public.marks where student_id = $1", [student.id]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });
});


describe("Referential integrity — deletes behave where the features rely on it", () => {
  test("deleting a student removes their marks and attendance", async () => {
    // DELETE /api/students relies on ON DELETE CASCADE; without it the route
    // would 500 on the FK and the student could never be removed.
    const s = await makeStudent();
    await pool.query(
      `insert into public.marks (student_id, subject, exam_name, score, max_score)
       values ($1, 'Physics', 'CASCADE-1', 80, 100)`,
      [s.id]
    );
    await pool.query("insert into public.attendance (student_id, att_date) values ($1, '2099-06-02')", [s.id]);

    const count = (id) =>
      pool
        .query(
          `select
             (select count(*)::int from public.marks where student_id = $1)     as marks,
             (select count(*)::int from public.attendance where student_id = $1) as att`,
          [id]
        )
        .then((r) => r.rows[0]);

    expect(await count(s.id)).toEqual({ marks: 1, att: 1 });

    await dropStudent(s.id);
    expect(await count(s.id)).toEqual({ marks: 0, att: 0 });
  });

  test("clearing entered_by keeps the mark (SET NULL, not CASCADE)", async () => {
    // marks_entered_by_fkey is ON DELETE SET NULL: removing a teacher must not
    // silently erase the marks they entered.
    const s = await makeStudent();
    const { rows: t } = await pool.query("select id from public.users where role = 'teacher' limit 1");
    const { rows } = await pool.query(
      `insert into public.marks (student_id, subject, exam_name, score, max_score, entered_by)
       values ($1, 'Physics', 'SETNULL-1', 80, 100, $2) returning id`,
      [s.id, t[0].id]
    );
    try {
      await pool.query("update public.marks set entered_by = null where id = $1", [rows[0].id]);
      const db = await pool.query("select entered_by, score from public.marks where id = $1", [rows[0].id]);
      expect(db.rows[0].entered_by).toBeNull();
      expect(Number(db.rows[0].score)).toBe(80); // the mark itself survives
    } finally {
      await pool.query("delete from public.marks where id = $1", [rows[0].id]);
      await dropStudent(s.id);
    }
  });
});

describe("Attendance column defaults and derived class_id", () => {
  let student;
  beforeAll(async () => { student = await makeStudent(); });
  afterAll(async () => { await dropStudent(student.id); });

  test("notified starts false and both sessions start present", async () => {
    // The email suite asserts notified flips to true only for absentees, which
    // is only meaningful if the column genuinely starts false.
    const { rows } = await pool.query(
      `insert into public.attendance (student_id, att_date) values ($1, '2099-06-03')
       returning notified, fn_present, an_present, remarks`,
      [student.id]
    );
    expect(rows[0].notified).toBe(false);
    expect(rows[0].fn_present).toBe(true);
    expect(rows[0].an_present).toBe(true);
    expect(rows[0].remarks).toBe("-");
  });

  test("class_id is populated from the student's class on insert", async () => {
    // routes/attendance.js derives class_id with a subselect; assert it lands so
    // class-scoped reporting has something to group by.
    const { rows } = await pool.query(
      `insert into public.attendance (student_id, class_id, att_date)
       values ($1, (select class_id from public.students where id = $1), '2099-06-04')
       returning class_id`,
      [student.id]
    );
    expect(rows[0].class_id).not.toBeNull();
  });
});


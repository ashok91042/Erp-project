/**
 * Transactional integrity tests for POST /api/attendance.
 * Verifies that a multi-record submission is atomic: any failure rolls back
 * the ENTIRE batch, leaving the attendance table untouched.
 */
const { request, app, pool, TEACHER, PARENT, createTempStudent, cleanupByRoll, getStudents } = require("./helpers");

describe("POST /api/attendance — transactional integrity", () => {
  let tempA, tempB, tempC;
  const date = "2099-01-15";

  beforeAll(async () => {
    tempA = await createTempStudent("A");
    tempB = await createTempStudent("B");
    tempC = await createTempStudent("C");
  });

  afterAll(async () => {
    for (const t of [tempA, tempB, tempC]) {
      await cleanupByRoll(t.student.roll_no);
    }
  });

  test("all valid records in a batch are committed together", async () => {
    const res = await request(app)
      .post("/api/attendance")
      .set(TEACHER)
      .send({
        date,
        records: [
          { studentId: tempA.student.id, fnPresent: true, anPresent: true },
          { studentId: tempB.student.id, fnPresent: false, anPresent: true, remarks: "Late" },
          { studentId: tempC.student.id, fnPresent: true, anPresent: false },
        ],
      })
      .expect(200);

    expect(res.body.saved).toBe(3);
    expect(res.body.absentees).toBe(2);

    const db = await pool.query(
      "select fn_present, an_present, remarks from public.attendance where student_id = $1 and att_date = $2",
      [tempB.student.id, date]
    );
    expect(db.rows[0].fn_present).toBe(false);
    expect(db.rows[0].an_present).toBe(true);
    expect(db.rows[0].remarks).toBe("Late");
  });

  test("one invalid studentId rolls back the WHOLE batch (atomicity)", async () => {
    // First put known state on the two valid students
    await request(app)
      .post("/api/attendance")
      .set(TEACHER)
      .send({
        date: "2099-01-16",
        records: [
          { studentId: tempA.student.id, fnPresent: true, anPresent: true },
          { studentId: tempB.student.id, fnPresent: true, anPresent: true },
        ],
      })
      .expect(200);

    // Now submit a batch where the LAST record is invalid (bad UUID)
    const res = await request(app)
      .post("/api/attendance")
      .set(TEACHER)
      .send({
        date: "2099-01-16",
        records: [
          { studentId: tempA.student.id, fnPresent: false, anPresent: false }, // would change state
          { studentId: "00000000-0000-0000-0000-00000000dead", fnPresent: false, anPresent: false }, // FK violation
        ],
      })
      .expect(500);

    expect(res.body.error).toMatch(/failed to save attendance/i);

    // CRITICAL: tempA must STILL have its previous state (all present) —
    // the batch was rolled back, not partially applied.
    const db = await pool.query(
      "select fn_present, an_present from public.attendance where student_id = $1 and att_date = $2",
      [tempA.student.id, "2099-01-16"]
    );
    expect(db.rows[0].fn_present).toBe(true);
    expect(db.rows[0].an_present).toBe(true);
  });

  test("upsert: resubmitting the same student+date updates instead of duplicating", async () => {
    await request(app)
      .post("/api/attendance")
      .set(TEACHER)
      .send({ date, records: [{ studentId: tempC.student.id, fnPresent: true, anPresent: true }] })
      .expect(200);

    await request(app)
      .post("/api/attendance")
      .set(TEACHER)
      .send({ date, records: [{ studentId: tempC.student.id, fnPresent: false, anPresent: false, remarks: "Updated" }] })
      .expect(200);

    const db = await pool.query(
      "select count(*)::int as n, fn_present, an_present, remarks from public.attendance where student_id = $1 and att_date = $2 group by fn_present, an_present, remarks",
      [tempC.student.id, date]
    );
    expect(db.rows[0].n).toBe(1); // exactly one row — no duplicates
    expect(db.rows[0].fn_present).toBe(false);
    expect(db.rows[0].remarks).toBe("Updated");
  });

  test("missing records[] or date returns 400 and writes nothing", async () => {
    await request(app).post("/api/attendance").set(TEACHER).send({ date }).expect(400);
    await request(app)
      .post("/api/attendance")
      .set(TEACHER)
      .send({ records: [{ studentId: tempA.student.id, fnPresent: true, anPresent: true }] })
      .expect(400);

    const db = await pool.query("select count(*)::int as n from public.attendance where att_date = '2099-01-17'");
    expect(db.rows[0].n).toBe(0);
  });

  test("parent role is forbidden from submitting attendance (403)", async () => {
    await request(app)
      .post("/api/attendance")
      .set(PARENT)
      .send({ date, records: [{ studentId: tempA.student.id, fnPresent: true, anPresent: true }] })
      .expect(403);
  });

  test("GET /api/attendance returns roster with submitted state", async () => {
    const res = await request(app).get(`/api/attendance?date=${date}`).set(TEACHER).expect(200);
    expect(res.body.date).toBe(date);
    expect(Array.isArray(res.body.rows)).toBe(true);

    const rowB = res.body.rows.find((r) => r.roll_no === tempB.student.roll_no);
    expect(rowB.fn_present).toBe(false);
    expect(rowB.an_present).toBe(true);
  });
});
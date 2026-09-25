/**
 * Automated email dispatch trigger tests.
 * Mocks the mailer module and asserts it is invoked (or not) based on the
 * FN/AN absence state of each submitted attendance record, and that the
 * `notified` column is updated in the DB afterwards.
 */
const { request, app, pool, TEACHER, createTempStudent, cleanupByRoll } = require("./helpers");

// Mock the mailer BEFORE the routes module captures its functions
jest.mock("../src/mailer", () => ({
  sendAbsenceAlert: jest.fn().mockResolvedValue({ sent: true, messageId: "test-123" }),
  sendRequestDecision: jest.fn().mockResolvedValue({ sent: true, messageId: "test-456" }),
}));
const { sendAbsenceAlert } = require("../src/mailer");

describe("Email dispatch trigger on FN/AN absence", () => {
  let tempFull, tempFN, tempAN, tempNone;
  const date = "2099-02-20";

  beforeAll(async () => {
    tempFull = await createTempStudent("Full");
    tempFN = await createTempStudent("FN");
    tempAN = await createTempStudent("AN");
    tempNone = await createTempStudent("None");
  });

  afterAll(async () => {
    for (const t of [tempFull, tempFN, tempAN, tempNone]) await cleanupByRoll(t.student.roll_no);
    jest.restoreAllMocks();
  });

  beforeEach(() => sendAbsenceAlert.mockClear());

  test("full-day absence (FN=false, AN=false) triggers ONE alert with session 'both'", async () => {
    await request(app)
      .post("/api/attendance")
      .set(TEACHER)
      .send({ date, records: [{ studentId: tempFull.student.id, fnPresent: false, anPresent: false }] })
      .expect(200);

    expect(sendAbsenceAlert).toHaveBeenCalledTimes(1);
    const call = sendAbsenceAlert.mock.calls[0][0];
    expect(call.session).toBe("both");
    expect(call.studentName).toBe(tempFull.student.full_name);
    expect(call.rollNo).toBe(tempFull.student.roll_no);
    expect(call.date).toBe(date);
  });

  test("FN-only absence triggers alert with session 'fn'", async () => {
    await request(app)
      .post("/api/attendance")
      .set(TEACHER)
      .send({ date: "2099-02-21", records: [{ studentId: tempFN.student.id, fnPresent: false, anPresent: true }] })
      .expect(200);

    expect(sendAbsenceAlert).toHaveBeenCalledTimes(1);
    expect(sendAbsenceAlert.mock.calls[0][0].session).toBe("fn");
  });

  test("AN-only absence triggers alert with session 'an'", async () => {
    await request(app)
      .post("/api/attendance")
      .set(TEACHER)
      .send({ date: "2099-02-22", records: [{ studentId: tempAN.student.id, fnPresent: true, anPresent: false }] })
      .expect(200);

    expect(sendAbsenceAlert).toHaveBeenCalledTimes(1);
    expect(sendAbsenceAlert.mock.calls[0][0].session).toBe("an");
  });

  test("all-present record does NOT trigger any alert", async () => {
    await request(app)
      .post("/api/attendance")
      .set(TEACHER)
      .send({ date: "2099-02-23", records: [{ studentId: tempNone.student.id, fnPresent: true, anPresent: true }] })
      .expect(200);

    expect(sendAbsenceAlert).not.toHaveBeenCalled();

    const db = await pool.query(
      "select notified from public.attendance where student_id = $1 and att_date = $2",
      [tempNone.student.id, "2099-02-23"]
    );
    expect(db.rows[0].notified).toBe(false);
  });

  test("mixed batch alerts only the absentees and sets notified=true in DB", async () => {
    const d = "2099-02-24";
    const res = await request(app)
      .post("/api/attendance")
      .set(TEACHER)
      .send({
        date: d,
        records: [
          { studentId: tempNone.student.id, fnPresent: true, anPresent: true },  // present — no alert
          { studentId: tempFN.student.id, fnPresent: false, anPresent: true },   // FN absent — alert
          { studentId: tempFull.student.id, fnPresent: false, anPresent: false },// both — alert
        ],
      })
      .expect(200);

    expect(res.body.absentees).toBe(2);

    // Wait for the fire-and-forget mailer to finish, then assert on the calls for THIS date only
    await new Promise((r) => setTimeout(r, 300));
    const callsForDate = sendAbsenceAlert.mock.calls.filter((c) => c[0].date === d);
    expect(callsForDate).toHaveLength(2);

    const sessions = callsForDate.map((c) => c[0].session).sort();
    expect(sessions).toEqual(["both", "fn"]);

    // notified flag flipped for the two absentees, not for the present one
    const db = await pool.query(
      "select student_id, notified from public.attendance where att_date = '2099-02-24' and student_id = any($1::uuid[])",
      [[tempNone.student.id, tempFN.student.id, tempFull.student.id]]
    );
    const byId = Object.fromEntries(db.rows.map((r) => [r.student_id, r.notified]));
    expect(byId[tempNone.student.id]).toBe(false);
    expect(byId[tempFN.student.id]).toBe(true);
    expect(byId[tempFull.student.id]).toBe(true);
  });

  test("mailer failure does not fail the request nor block the attendance save", async () => {
    sendAbsenceAlert.mockRejectedValueOnce(new Error("SMTP down"));
    const res = await request(app)
      .post("/api/attendance")
      .set(TEACHER)
      .send({ date: "2099-02-25", records: [{ studentId: tempFull.student.id, fnPresent: false, anPresent: true }] })
      .expect(200);

    expect(res.body.saved).toBe(1);
    // Attendance row still saved despite mail failure
    const db = await pool.query(
      "select fn_present from public.attendance where student_id = $1 and att_date = $2",
      [tempFull.student.id, "2099-02-25"]
    );
    expect(db.rows[0].fn_present).toBe(false);
  });
});
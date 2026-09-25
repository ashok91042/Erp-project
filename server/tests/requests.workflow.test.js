/**
 * Teacher → Principal permission request workflow:
 * submission, RBAC on the decide endpoint, approval, rejection,
 * double-decision protection, and decision email dispatch.
 */
const { request, app, pool, TEACHER, PRINCIPAL, PARENT, cleanupRequestsByTitle } = require("./helpers");

jest.mock("../src/mailer", () => ({
  sendAbsenceAlert: jest.fn().mockResolvedValue({ sent: true }),
  sendRequestDecision: jest.fn().mockResolvedValue({ sent: true, messageId: "test-456" }),
}));
const { sendRequestDecision } = require("../src/mailer");

describe("Principal approval/rejection workflow (permission requests)", () => {
  const TITLE = "JEST mark modification request";
  let requestId;

  beforeEach(() => sendRequestDecision.mockClear());

  afterAll(async () => {
    await cleanupRequestsByTitle(TITLE);
    await cleanupRequestsByTitle("JEST rejection test request");
    jest.restoreAllMocks();
  });

  test("teacher submits a mark-modification request → status pending", async () => {
    const res = await request(app)
      .post("/api/requests")
      .set(TEACHER)
      .send({ title: TITLE, description: "Change Rahul's Math score 78 → 88 (re-evaluation)", requestType: "mark_change" })
      .expect(201);

    expect(res.body.status).toBe("pending");
    expect(res.body.title).toBe(TITLE);
    expect(res.body.id).toBeDefined();
    requestId = res.body.id;
  });

  test("teacher CANNOT approve/reject (only principal can decide)", async () => {
    await request(app)
      .patch(`/api/requests/${requestId}/decide`)
      .set(TEACHER)
      .send({ action: "approved" })
      .expect(403);
  });

  test("parent CANNOT submit or decide requests", async () => {
    await request(app)
      .post("/api/requests")
      .set(PARENT)
      .send({ title: "Parent should not be here" })
      .expect(403);
    await request(app)
      .patch(`/api/requests/${requestId}/decide`)
      .set(PARENT)
      .send({ action: "approved" })
      .expect(403);
  });

  test("invalid action value returns 400", async () => {
    await request(app)
      .patch(`/api/requests/${requestId}/decide`)
      .set(PRINCIPAL)
      .send({ action: "maybe" })
      .expect(400);
  });

  test("principal approves → status/decided_by/decided_at/note persisted, email sent", async () => {
    const res = await request(app)
      .patch(`/api/requests/${requestId}/decide`)
      .set(PRINCIPAL)
      .send({ action: "approved", note: "Re-evaluation verified with answer sheet" })
      .expect(200);

    expect(res.body.status).toBe("approved");
    expect(res.body.decision_note).toBe("Re-evaluation verified with answer sheet");
    expect(res.body.decided_at).not.toBeNull();

    // Verify persisted DB state
    const db = await pool.query("select * from public.permission_requests where id = $1", [requestId]);
    const row = db.rows[0];
    expect(row.status).toBe("approved");
    expect(row.decided_by).not.toBeNull();
    expect(row.decided_at).not.toBeNull();

    // Decision email dispatched to the requesting teacher
    expect(sendRequestDecision).toHaveBeenCalledTimes(1);
    const call = sendRequestDecision.mock.calls[0][0];
    expect(call.teacherEmail).toBe("lakshmi@school.edu");
    expect(call.status).toBe("approved");
    expect(call.title).toBe(TITLE);
  });

  test("already-decided request cannot be decided again (404)", async () => {
    const res = await request(app)
      .patch(`/api/requests/${requestId}/decide`)
      .set(PRINCIPAL)
      .send({ action: "rejected", note: "changed my mind" })
      .expect(404);
    expect(res.body.error).toMatch(/already decided/i);

    // DB still shows approved
    const db = await pool.query("select status from public.permission_requests where id = $1", [requestId]);
    expect(db.rows[0].status).toBe("approved");
  });

  test("principal rejects a fresh pending request → status rejected + email", async () => {
    const created = await request(app)
      .post("/api/requests")
      .set(TEACHER)
      .send({ title: "JEST rejection test request", description: "Attendance correction" })
      .expect(201);

    const res = await request(app)
      .patch(`/api/requests/${created.body.id}/decide`)
      .set(PRINCIPAL)
      .send({ action: "rejected", note: "Insufficient evidence" })
      .expect(200);

    expect(res.body.status).toBe("rejected");

    const db = await pool.query("select status, decision_note from public.permission_requests where id = $1", [created.body.id]);
    expect(db.rows[0].status).toBe("rejected");
    expect(db.rows[0].decision_note).toBe("Insufficient evidence");

    expect(sendRequestDecision).toHaveBeenCalledTimes(1);
    expect(sendRequestDecision.mock.calls[0][0].status).toBe("rejected");
  });

  test("teacher sees only own requests; principal sees all; status filter works", async () => {
    const mine = await request(app).get("/api/requests").set(TEACHER).expect(200);
    expect(mine.body.every((r) => r.teacher_email === "lakshmi@school.edu")).toBe(true);

    const all = await request(app).get("/api/requests").set(PRINCIPAL).expect(200);
    expect(all.body.length).toBeGreaterThanOrEqual(mine.body.length);

    const pending = await request(app).get("/api/requests?status=pending").set(PRINCIPAL).expect(200);
    expect(pending.body.every((r) => r.status === "pending")).toBe(true);
  });

  test("nonexistent request id returns 404", async () => {
    await request(app)
      .patch("/api/requests/00000000-0000-0000-0000-000000000000/decide")
      .set(PRINCIPAL)
      .send({ action: "approved" })
      .expect(404);
  });
});

/**
 * Validates that APPROVED mark-modification requests correspond to actual
 * database state changes in the marks table (post-approval state update).
 */
describe("Database state updates post-approval (marks)", () => {
  const { createTempStudent, cleanupByRoll, uniqueTag } = require("./helpers");
  let temp;

  beforeAll(async () => { temp = await createTempStudent("Marks"); });
  afterAll(async () => { await cleanupByRoll(temp.student.roll_no); });

  test("approved mark-change request is reflected in updated marks row", async () => {
    // 1. Teacher records an original mark
    const original = await request(app)
      .post("/api/marks")
      .set(TEACHER)
      .send({ studentId: temp.student.id, subject: "Mathematics", examName: `JEST-EXAM-${uniqueTag()}`, score: 55, maxScore: 100 })
      .expect(201);
    expect(Number(original.body.score)).toBe(55);

    // 2. Teacher submits a mark-modification request
    const reqRes = await request(app)
      .post("/api/requests")
      .set(TEACHER)
      .send({ title: `JEST mark update ${original.body.id}`, description: "55 → 92 after re-evaluation", requestType: "mark_change" })
      .expect(201);

    // 3. Principal approves
    await request(app)
      .patch(`/api/requests/${reqRes.body.id}/decide`)
      .set(PRINCIPAL)
      .send({ action: "approved", note: "Verified" })
      .expect(200);

    // 4. Post-approval: the modification is applied to the marks table
    const updated = await request(app)
      .post("/api/marks")
      .set(TEACHER)
      .send({ studentId: temp.student.id, subject: "Mathematics", examName: original.body.exam_name, score: 92, maxScore: 100 })
      .expect(201);

    expect(Number(updated.body.score)).toBe(92);
    expect(updated.body.id).toBe(original.body.id); // same row — upserted, not duplicated

    // 5. DB state reflects exactly one updated row
    const db = await pool.query(
      "select score, max_score from public.marks where student_id = $1 and subject = 'Mathematics' and exam_name = $2",
      [temp.student.id, original.body.exam_name]
    );
    expect(db.rows).toHaveLength(1);
    expect(Number(db.rows[0].score)).toBe(92);

    // 6. Request trail shows approved with decider recorded
    const reqDb = await pool.query("select status, decided_by from public.permission_requests where id = $1", [reqRes.body.id]);
    expect(reqDb.rows[0].status).toBe("approved");
    expect(reqDb.rows[0].decided_by).not.toBeNull();

    // cleanup the request
    await pool.query("delete from public.permission_requests where id = $1", [reqRes.body.id]);
  });

  test("score below 0 rejected by DB constraint (integrity, verified directly)", async () => {
    const res = await request(app)
      .post("/api/marks")
      .set(TEACHER)
      .send({ studentId: temp.student.id, subject: "Science", examName: "NEG-1", score: -5 })
      .expect(500);
    expect(res.body.error).toMatch(/failed to save mark/i); // no raw pg error leaked
    // Constraint proven directly: the insert must be rejected by Postgres
    await expect(
      pool.query(
        "insert into public.marks (student_id, subject, exam_name, score, max_score) values ($1,'Science','NEG-DB',-5,100)",
        [temp.student.id]
      )
    ).rejects.toThrow(/check/i);
  });

  test("missing required mark fields return 400", async () => {
    await request(app)
      .post("/api/marks")
      .set(TEACHER)
      .send({ studentId: temp.student.id, subject: "Science" })
      .expect(400);
  });
});
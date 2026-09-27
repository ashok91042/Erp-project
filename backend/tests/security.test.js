/**
 * Security regression suite.
 * Covers: JWT verification (forgery/expiry/claims), demo-header impersonation
 * gating, BOLA/IDOR class-ownership & parent scoping, SMTP header/content
 * injection sanitization, and SQL injection smoke vectors.
 */
process.env.SUPABASE_JWT_SECRET = "test-jwt-secret-for-security-suite";
const jwt = require("jsonwebtoken");
const { request, app, pool, TEACHER, PRINCIPAL, PARENT, createTempStudent, cleanupByRoll, uniqueTag } = require("./helpers");
const mailer = require("../src/mailer");

const signToken = (payload, opts = {}) =>
  jwt.sign({ role: "authenticated", ...payload }, process.env.SUPABASE_JWT_SECRET, { expiresIn: "10m", ...opts });

describe("JWT verification middleware", () => {
  test("valid signed token with known user email authenticates", async () => {
    const token = signToken({ email: "principal@school.edu" });
    const res = await request(app).get("/api/requests").set("Authorization", `Bearer ${token}`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("token signed with wrong secret (forged) is rejected", async () => {
    const forged = jwt.sign({ email: "principal@school.edu", role: "authenticated" }, "attacker-secret", { expiresIn: "10m" });
    await request(app).get("/api/requests").set("Authorization", `Bearer ${forged}`).expect(401);
  });

  test("expired token is rejected", async () => {
    const expired = signToken({ email: "principal@school.edu" }, { expiresIn: "-10s" });
    await request(app).get("/api/requests").set("Authorization", `Bearer ${expired}`).expect(401);
  });

  test("anon-role token (Supabase anon key style) cannot access authed endpoints", async () => {
    const anon = signToken({ email: "principal@school.edu", role: "anon" });
    await request(app).get("/api/requests").set("Authorization", `Bearer ${anon}`).expect(401);
  });

  test("token for unknown user email is rejected (no auto-registration)", async () => {
    const token = signToken({ email: "ghost@evil.io" });
    await request(app).get("/api/requests").set("Authorization", `Bearer ${token}`).expect(401);
  });

  test("missing JWT secret fails closed (503), never open", async () => {
    // clear BOTH signing secrets (app login tokens + Supabase tokens)
    const savedSupabase = process.env.SUPABASE_JWT_SECRET;
    const savedApp = process.env.APP_JWT_SECRET;
    const token = signToken({ email: "principal@school.edu" }); // sign BEFORE removing secrets
    delete process.env.SUPABASE_JWT_SECRET;
    delete process.env.APP_JWT_SECRET;
    try {
      await request(app).get("/api/requests").set("Authorization", `Bearer ${token}`).expect(503);
    } finally {
      process.env.SUPABASE_JWT_SECRET = savedSupabase;
      if (savedApp !== undefined) process.env.APP_JWT_SECRET = savedApp;
      else delete process.env.APP_JWT_SECRET;
    }
  });
});

describe("Demo header impersonation gating", () => {
  afterEach(() => { delete process.env.ALLOW_DEMO_HEADERS; });

  test("x-demo headers are ignored when ALLOW_DEMO_HEADERS=false (no identity, 401)", async () => {
    process.env.ALLOW_DEMO_HEADERS = "false";
    await request(app).get("/api/students").set(TEACHER).expect(401);
  });

  test("x-demo-role cannot elevate privileges: teacher stays teacher regardless of claimed role", async () => {
    const res = await request(app)
      .patch("/api/requests/00000000-0000-0000-0000-000000000000/decide")
      .set({ "x-demo-email": "lakshmi@school.edu", "x-demo-role": "principal" })
      .send({ action: "approved" })
      .expect(403); // teacher role from DB, not the spoofed header
    expect(res.body.error).toMatch(/principal/i);
  });
});

describe("BOLA / IDOR protections", () => {
  let tempOwn, foreign; // foreign = student in another teacher's class

  beforeAll(async () => {
    tempOwn = await createTempStudent("Own");
    const tag = uniqueTag();
    const t = await pool.query(
      "insert into public.users (email, full_name, role) values ($1,'Evil Teacher','teacher') returning id",
      [`evil.teacher.${tag}@school.edu`]
    );
    const c = await pool.query(
      "insert into public.classes (name, teacher_id) values ($1,$2) returning id",
      [`Class EVIL-${tag}`, t.rows[0].id]
    );
    const s = await pool.query(
      "insert into public.students (roll_no, full_name, class_id, parent_email) values ($1,'Foreign Student',$2,'other.parent@mail.com') returning id, roll_no",
      [`EVIL-${tag}`, c.rows[0].id]
    );
    foreign = { teacherId: t.rows[0].id, classId: c.rows[0].id, student: s.rows[0], tag };
  });

  afterAll(async () => {
    await cleanupByRoll(tempOwn.student.roll_no);
    await pool.query("delete from public.attendance where student_id = $1", [foreign.student.id]);
    await pool.query("delete from public.marks where student_id = $1", [foreign.student.id]);
    await pool.query("delete from public.students where id = $1", [foreign.student.id]);
    await pool.query("delete from public.classes where id = $1", [foreign.classId]);
    await pool.query("delete from public.users where id = $1", [foreign.teacherId]);
  });

  test("teacher CANNOT submit attendance for a student in another class (403, nothing written)", async () => {
    const res = await request(app)
      .post("/api/attendance")
      .set(TEACHER)
      .send({
        date: "2099-04-01",
        records: [
          { studentId: tempOwn.student.id, fnPresent: true, anPresent: true },
          { studentId: foreign.student.id, fnPresent: false, anPresent: false },
        ],
      })
      .expect(403);
    expect(res.body.error).toMatch(/outside your class/i);
    const db = await pool.query(
      "select count(*)::int as n from public.attendance where student_id = $1 and att_date = '2099-04-01'",
      [tempOwn.student.id]
    );
    expect(db.rows[0].n).toBe(0); // not even the legitimate record was written
  });

  test("teacher CANNOT enter marks for a student in another class (403)", async () => {
    await request(app)
      .post("/api/marks")
      .set(TEACHER)
      .send({ studentId: foreign.student.id, subject: "Mathematics", examName: "BOLA-1", score: 10 })
      .expect(403);
  });


describe("SMTP header & email content injection", () => {
  test("sanitizeHeader strips CRLF/control chars (header injection neutralized)", () => {
    const evil = "Aarav\r\nBcc: attacker@evil.com\nX-Evil: 1";
    const clean = mailer.sanitizeHeader(evil);
    expect(clean).not.toMatch(/[\r\n]/);
    expect(clean).not.toMatch(/[\x00-\x1F]/);
  });

  test("buildAbsenceMail subject contains no CRLF even with hostile inputs", () => {
    const mail = mailer.buildAbsenceMail({
      studentName: "Evil\r\nSubject: spam\r\nBcc: h4x@evil.com",
      rollNo: "10A-01\nIn-Reply-To: <x@y>",
      date: "2099-01-01\r\n",
      session: "both",
      parentEmail: "parent@mail.com",
    });
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.to).toBe("parent@mail.com");
  });

  test("buildAbsenceMail escapes HTML (content injection into email body)", () => {
    const mail = mailer.buildAbsenceMail({
      studentName: "<script>alert(1)</script><img src=x onerror=alert(2)>",
      rollNo: "10A-01",
      date: "2099-01-01",
      session: "fn",
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  test("invalid/hostile recipient email is never used as an address", () => {
    const mail = mailer.buildAbsenceMail({
      studentName: "A", rollNo: "R", date: "2099-01-01", session: "fn",
      parentEmail: "not-an-email\r\nBcc: evil@x.com",
    });
    expect(mail.to).toBeNull();
  });
});

describe("SQL injection vectors", () => {
  test("status filter with SQL payload is treated as a literal (no rows, no error)", async () => {
    const res = await request(app)
      .get("/api/requests?status=pending%27%20OR%201%3D1%20--")
      .set(PRINCIPAL)
      .expect(200);
    expect(res.body).toHaveLength(0); // payload matched nothing; no injection
  });

  test("date parameter with SQL payload is rejected by validation; table intact", async () => {
    await request(app)
      .get("/api/attendance?date=2099-01-01%27%3B%20DROP%20TABLE%20students%3B%20--")
      .set(TEACHER)
      .expect(400);
    const db = await pool.query("select count(*)::int as n from public.students");
    expect(db.rows[0].n).toBeGreaterThan(0);
  });

  test("marks fields with injection payloads are stored as literal data", async () => {
    const temp = await createTempStudent("SQLI");
    try {
      const res = await request(app)
        .post("/api/marks")
        .set(TEACHER)
        .send({ studentId: temp.student.id, subject: "Math'; DROP TABLE marks; --", examName: "E1", score: 50 })
        .expect(201);
      expect(res.body.subject).toBe("Math'; DROP TABLE marks; --");
      const db = await pool.query("select count(*)::int as n from public.marks");
      expect(db.rows[0].n).toBeGreaterThan(0); // table intact
      await pool.query("delete from public.marks where student_id = $1", [temp.student.id]);
    } finally {
      await cleanupByRoll(temp.student.roll_no);
    }
  });
});
  test("teacher reading marks sees ONLY own class (foreign marks invisible)", async () => {
    await pool.query(
      "insert into public.marks (student_id, subject, exam_name, score, max_score) values ($1,'Science','BOLA-SCOPE',99,100)",
      [foreign.student.id]
    );
    const mine = await request(app).get("/api/marks").set(TEACHER).expect(200);
    expect(mine.body.some((m) => m.student_id === foreign.student.id)).toBe(false);

    const evilHeaders = { "x-demo-email": `evil.teacher.${foreign.tag}@school.edu` };
    const theirs = await request(app).get("/api/marks").set(evilHeaders).expect(200);
    expect(theirs.body.some((m) => m.student_id === foreign.student.id)).toBe(true);
    await pool.query("delete from public.marks where student_id = $1", [foreign.student.id]);
  });

  test("parent reading marks/students sees ONLY their own children", async () => {
    const all = await request(app).get("/api/marks").set(PARENT).expect(200);
    expect(all.body.filter((m) => m.student_id === foreign.student.id)).toHaveLength(0);

    const students = await request(app).get("/api/students").set(PARENT).expect(200);
    expect(students.body.some((s) => s.roll_no === foreign.student.roll_no)).toBe(false);
  });

  test("unauthenticated users cannot read students/marks/attendance (401)", async () => {
    await request(app).get("/api/students").expect(401);
    await request(app).get("/api/marks").expect(401);
    await request(app).get("/api/attendance?date=2099-04-01").expect(401);
  });
});
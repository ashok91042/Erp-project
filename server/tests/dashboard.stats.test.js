/**
 * Dashboard aggregates & directory endpoints introduced with the loginless,
 * data-driven UI: GET /api/me, /api/stats, /api/teachers, /api/parents and the
 * scoped /api/classes list. Covers role scoping, 401/403 gating and validation.
 */
const { request, app, pool, TEACHER, PARENT, uniqueTag } = require("./helpers");

const PRINCIPAL = { "x-demo-email": "principal@school.edu", "x-demo-role": "principal" };

describe("GET /api/me — identity", () => {
  test("resolves the caller's profile from the database", async () => {
    const res = await request(app).get("/api/me").set(PRINCIPAL).expect(200);
    expect(res.body.email).toBe("principal@school.edu");
    expect(res.body.role).toBe("principal");
    expect(res.body.full_name).toBeTruthy();
  });

  test("requires authentication (401)", async () => {
    await request(app).get("/api/me").expect(401);
  });
});

describe("GET /api/stats — role-scoped aggregates", () => {
  test("principal sees institution-wide counts", async () => {
    const res = await request(app).get("/api/stats").set(PRINCIPAL).expect(200);
    expect(res.body.role).toBe("principal");
    expect(res.body.students).toBeGreaterThan(0);
    expect(res.body.teachers).toBeGreaterThan(0);
    expect(Array.isArray(res.body.classStrength)).toBe(true);
    expect(Array.isArray(res.body.attendanceTrend)).toBe(true);
    expect(res.body.me.name).toBeTruthy();
  });

  test("teacher counts only students in their own classes", async () => {
    const res = await request(app).get("/api/stats").set(TEACHER).expect(200);
    expect(res.body.role).toBe("teacher");
    const { rows } = await pool.query(
      "select c.name from public.classes c join public.users u on u.id = c.teacher_id where u.email = 'lakshmi@school.edu'"
    );
    const mine = rows.map((r) => r.name);
    res.body.classStrength.forEach((c) => expect(mine).toContain(c.name));
  });

  test("parent has no pending-request workload", async () => {
    const res = await request(app).get("/api/stats").set(PARENT).expect(200);
    expect(res.body.role).toBe("parent");
    expect(res.body.pendingRequests).toBe(0);
  });

  test("requires authentication (401)", async () => {
    await request(app).get("/api/stats").expect(401);
  });
});

describe("GET /api/teachers & /api/parents — principal directories", () => {
  test("teachers list includes seeded staff with their classes", async () => {
    const res = await request(app).get("/api/teachers").set(PRINCIPAL).expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    const t = res.body.find((x) => x.email === "lakshmi@school.edu");
    expect(t).toBeTruthy();
    expect(Array.isArray(t.classes)).toBe(true);
  });

  test("parents list aggregates children and classes", async () => {
    const res = await request(app).get("/api/parents").set(PRINCIPAL).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    const p = res.body.find((x) => x.email === "parent.demo@mail.com");
    expect(p).toBeTruthy();
    expect(p.children).toBeGreaterThan(0);
    expect(p.child_names).toBeTruthy();
  });

  test("teacher and parent are forbidden (403)", async () => {
    await request(app).get("/api/teachers").set(TEACHER).expect(403);
    await request(app).get("/api/parents").set(PARENT).expect(403);
  });

  test("unauthenticated access is rejected (401)", async () => {
    await request(app).get("/api/teachers").expect(401);
    await request(app).get("/api/parents").expect(401);
  });
});

describe("GET /api/classes — scoped + student_count", () => {
  test("principal sees all classes with student counts", async () => {
    const res = await request(app).get("/api/classes").set(PRINCIPAL).expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("student_count");
  });

  test("teacher sees only their own classes", async () => {
    const res = await request(app).get("/api/classes").set(TEACHER).expect(200);
    const { rows } = await pool.query(
      "select c.name from public.classes c join public.users u on u.id = c.teacher_id where u.email = 'lakshmi@school.edu'"
    );
    const mine = rows.map((r) => r.name);
    res.body.forEach((c) => expect(mine).toContain(c.name));
  });

  test("unauthenticated access is rejected (401)", async () => {
    await request(app).get("/api/classes").expect(401);
  });
});

describe("PATCH & DELETE /api/students/:id", () => {
  const tag = uniqueTag();
  let created;

  beforeAll(async () => {
    const { rows } = await pool.query("select id from public.classes limit 1");
    const res = await request(app)
      .post("/api/students")
      .set(PRINCIPAL)
      .send({ rollNo: `DEL-${tag}`, fullName: `Temp Student ${tag}`, classId: rows[0].id })
      .expect(201);
    created = res.body;
  });

  afterAll(async () => {
    await pool.query("delete from public.students where roll_no = $1", [`DEL-${tag}`]);
  });

  test("principal updates full name and parent email", async () => {
    const res = await request(app)
      .patch(`/api/students/${created.id}`)
      .set(PRINCIPAL)
      .send({ fullName: `Renamed ${tag}`, parentEmail: "parent.demo@mail.com" })
      .expect(200);
    expect(res.body.full_name).toBe(`Renamed ${tag}`);
    expect(res.body.parent_email).toBe("parent.demo@mail.com");
  });

  test("invalid class id is rejected (400)", async () => {
    await request(app)
      .patch(`/api/students/${created.id}`)
      .set(PRINCIPAL)
      .send({ classId: "not-a-uuid" })
      .expect(400);
  });

  test("malformed parent email is rejected (400)", async () => {
    await request(app)
      .patch(`/api/students/${created.id}`)
      .set(PRINCIPAL)
      .send({ parentEmail: "not-an-email" })
      .expect(400);
  });

  test("teacher cannot update a student (403)", async () => {
    await request(app)
      .patch(`/api/students/${created.id}`)
      .set(TEACHER)
      .send({ fullName: "Nope" })
      .expect(403);
  });

  test("unknown student id returns 404", async () => {
    await request(app)
      .patch("/api/students/00000000-0000-0000-0000-000000000000")
      .set(PRINCIPAL)
      .send({ fullName: "Ghost" })
      .expect(404);
  });

  test("principal deletes the student", async () => {
    const res = await request(app).delete(`/api/students/${created.id}`).set(PRINCIPAL).expect(200);
    expect(res.body.deleted).toBe(created.id);
    const check = await request(app).get("/api/students").set(PRINCIPAL);
    expect(check.body.some((s) => s.id === created.id)).toBe(false);
  });

  test("unauthenticated delete is rejected (401)", async () => {
    await request(app).delete(`/api/students/${created.id}`).expect(401);
  });
});


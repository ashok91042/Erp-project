/**
 * Add Teacher flow: POST /api/teachers (principal-only, validation, RBAC) plus
 * the PATCH/DELETE round-trip. Rows are created through the API and cleaned up
 * by the email marker; any class reassignment is rolled back in afterAll.
 */
const { request, app, pool, TEACHER, PARENT, PRINCIPAL, uniqueTag } = require("./helpers");

describe("POST /api/teachers — create teacher", () => {
  const tag = uniqueTag();
  const email = `teacher.${tag}@school.edu`;
  const password = "TestPass123!";
  let classId;
  let originalClassId;
  let createdId;

  beforeAll(async () => {
    const { rows } = await pool.query("select id, teacher_id from public.classes limit 1");
    classId = rows[0].id;
    originalClassId = rows[0].teacher_id;
  });

  afterAll(async () => {
    await pool.query("delete from public.users where email = $1", [email]);
    // Put the demo class back with its original teacher.
    if (originalClassId) {
      await pool.query("update public.classes set teacher_id = $1 where id = $2", [originalClassId, classId]);
    } else {
      await pool.query("update public.classes set teacher_id = null where id = $1", [classId]);
    }
  });

  test("principal creates a teacher (201) with role=teacher", async () => {
    const res = await request(app)
      .post("/api/teachers")
      .set(PRINCIPAL)
      .send({ fullName: `API Teacher ${tag}`, email, password })
      .expect(201);
    createdId = res.body.id;
    expect(res.body.email).toBe(email);
    expect(res.body.full_name).toBe(`API Teacher ${tag}`);
    expect(res.body.role).toBe("teacher");
    expect(res.body).not.toHaveProperty("password_hash");

    // Appears in the principal directory.
    const list = await request(app).get("/api/teachers").set(PRINCIPAL).expect(200);
    const found = list.body.find((t) => t.email === email);
    expect(found).toBeTruthy();
    expect(found.classes).toEqual([]);
  });

  test("the new teacher can sign in with the password that was set", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password })
      .expect(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe("teacher");
  });

  test("duplicate email returns 409", async () => {
    const res = await request(app)
      .post("/api/teachers")
      .set(PRINCIPAL)
      .send({ fullName: "Duplicate", email, password })
      .expect(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  test("missing full name returns 400", async () => {
    await request(app)
      .post("/api/teachers")
      .set(PRINCIPAL)
      .send({ email: `x.${tag}@school.edu`, password })
      .expect(400);
  });

  test("malformed email returns 400", async () => {
    await request(app)
      .post("/api/teachers")
      .set(PRINCIPAL)
      .send({ fullName: "Bad Email", email: "not-an-email", password })
      .expect(400);
  });

  test("password shorter than 8 characters returns 400", async () => {
    await request(app)
      .post("/api/teachers")
      .set(PRINCIPAL)
      .send({ fullName: "Short Pass", email: `s.${tag}@school.edu`, password: "abc" })
      .expect(400);
  });

  test("unknown class id returns 400", async () => {
    await request(app)
      .post("/api/teachers")
      .set(PRINCIPAL)
      .send({
        fullName: "Bad Class",
        email: `c.${tag}@school.edu`,
        password,
        classId: "00000000-0000-0000-0000-000000000000",
      })
      .expect(400);
  });

  test("teacher cannot create teachers (403)", async () => {
    await request(app)
      .post("/api/teachers")
      .set(TEACHER)
      .send({ fullName: "Teacher Insert", email: `t.${tag}@school.edu`, password })
      .expect(403);
  });

  test("parent cannot create teachers (403)", async () => {
    await request(app)
      .post("/api/teachers")
      .set(PARENT)
      .send({ fullName: "Parent Insert", email: `p.${tag}@school.edu`, password })
      .expect(403);
  });

  test("unauthenticated create returns 401", async () => {
    await request(app)
      .post("/api/teachers")
      .send({ fullName: "Anonymous", email: `n.${tag}@school.edu`, password })
      .expect(401);
  });

  test("PATCH renames the teacher and assigns a class", async () => {
    const res = await request(app)
      .patch(`/api/teachers/${createdId}`)
      .set(PRINCIPAL)
      .send({ fullName: `Renamed ${tag}`, classId })
      .expect(200);
    expect(res.body.full_name).toBe(`Renamed ${tag}`);

    const list = await request(app).get("/api/teachers").set(PRINCIPAL).expect(200);
    const found = list.body.find((t) => t.id === createdId);
    expect(found.classIds).toEqual([classId]);
  });

  test("PATCH with no updatable fields returns 400", async () => {
    await request(app)
      .patch(`/api/teachers/${createdId}`)
      .set(PRINCIPAL)
      .send({})
      .expect(400);
  });

  test("PATCH on an unknown id returns 404", async () => {
    await request(app)
      .patch("/api/teachers/00000000-0000-0000-0000-000000000000")
      .set(PRINCIPAL)
      .send({ fullName: "Ghost" })
      .expect(404);
  });

  test("DELETE removes the teacher and unassigns their class", async () => {
    await request(app).delete(`/api/teachers/${createdId}`).set(PRINCIPAL).expect(200);

    const list = await request(app).get("/api/teachers").set(PRINCIPAL).expect(200);
    expect(list.body.some((t) => t.id === createdId)).toBe(false);

    // Class 10A must not still point at the deleted teacher.
    const { rows } = await pool.query("select teacher_id from public.classes where id = $1", [classId]);
    expect(rows[0].teacher_id).not.toBe(createdId);
  });

  test("DELETE on an unknown id returns 404", async () => {
    await request(app)
      .delete("/api/teachers/00000000-0000-0000-0000-000000000000")
      .set(PRINCIPAL)
      .expect(404);
  });
});
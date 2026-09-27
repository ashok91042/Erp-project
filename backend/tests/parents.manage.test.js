/**
 * Add Parent flow: POST /api/parents (principal-only, validation, RBAC) plus the
 * PATCH/DELETE round-trip and child (re)linking. Parents are keyed by email
 * because `students.parent_email` is the link. Any student link touched by the
 * suite is captured up front and restored in afterAll.
 */
const { request, app, pool, TEACHER, PARENT, PRINCIPAL, uniqueTag } = require("./helpers");

describe("POST/PATCH/DELETE /api/parents — manage parents", () => {
  const tag = uniqueTag();
  const email = `parent.${tag}@school.edu`;
  const password = "TestPass123!";
  const ref = encodeURIComponent(email);
  let childId, childOriginal, otherChild, otherOriginal;

  beforeAll(async () => {
    const { rows } = await pool.query(
      "select id, parent_email from public.students order by roll_no limit 2"
    );
    childId = rows[0].id;
    childOriginal = rows[0].parent_email;
    otherChild = rows[1].id;
    otherOriginal = rows[1].parent_email;
  });

  afterAll(async () => {
    await pool.query("delete from public.users where email = $1", [email]);
    // Put the demo students back exactly as they were.
    await pool.query("update public.students set parent_email = $1 where id = $2", [childOriginal, childId]);
    await pool.query("update public.students set parent_email = $1 where id = $2", [otherOriginal, otherChild]);
  });

  test("principal creates a parent (201) with role=parent", async () => {
    const res = await request(app)
      .post("/api/parents")
      .set(PRINCIPAL)
      .send({ fullName: `API Parent ${tag}`, email, password })
      .expect(201);
    expect(res.body.email).toBe(email);
    expect(res.body.role).toBe("parent");
    expect(res.body).not.toHaveProperty("password_hash");
  });

  test("the new parent can sign in with the password that was set", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password }).expect(200);
    expect(res.body.user.role).toBe("parent");
  });

  test("linking a child moves them to this parent", async () => {
    await request(app)
      .patch(`/api/parents/${ref}`)
      .set(PRINCIPAL)
      .send({ studentIds: [childId] })
      .expect(200);

    const { rows } = await pool.query("select parent_email from public.students where id = $1", [childId]);
    expect(rows[0].parent_email).toBe(email);

    const list = await request(app).get("/api/parents").set(PRINCIPAL).expect(200);
    const found = list.body.find((p) => p.email === email);
    expect(found.children).toBe(1);
    expect(found.student_ids).toEqual([childId]);
  });

  test("duplicate email returns 409", async () => {
    const res = await request(app)
      .post("/api/parents")
      .set(PRINCIPAL)
      .send({ fullName: "Duplicate", email, password })
      .expect(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  test("missing full name returns 400", async () => {
    await request(app)
      .post("/api/parents")
      .set(PRINCIPAL)
      .send({ email: `x.${tag}@school.edu`, password })
      .expect(400);
  });

  test("malformed email returns 400", async () => {
    await request(app)
      .post("/api/parents")
      .set(PRINCIPAL)
      .send({ fullName: "Bad Email", email: "not-an-email", password })
      .expect(400);
  });

  test("password shorter than 8 characters returns 400", async () => {
    await request(app)
      .post("/api/parents")
      .set(PRINCIPAL)
      .send({ fullName: "Short Pass", email: `s.${tag}@school.edu`, password: "abc" })
      .expect(400);
  });
  test("studentIds must be an array of valid ids", async () => {
    await request(app)
      .post("/api/parents")
      .set(PRINCIPAL)
      .send({ fullName: "X", email: `y.${tag}@school.edu`, password, studentIds: "oops" })
      .expect(400);
    await request(app)
      .post("/api/parents")
      .set(PRINCIPAL)
      .send({ fullName: "X", email: `z.${tag}@school.edu`, password, studentIds: ["not-a-uuid"] })
      .expect(400);
  });

  test("unknown student id returns 400", async () => {
    await request(app)
      .post("/api/parents")
      .set(PRINCIPAL)
      .send({
        fullName: "X",
        email: `u.${tag}@school.edu`,
        password,
        studentIds: ["00000000-0000-0000-0000-000000000000"],
      })
      .expect(400);
  });

  test("teacher cannot create parents (403)", async () => {
    await request(app)
      .post("/api/parents")
      .set(TEACHER)
      .send({ fullName: "Teacher Insert", email: `t.${tag}@school.edu`, password })
      .expect(403);
  });

  test("parent cannot create parents (403)", async () => {
    await request(app)
      .post("/api/parents")
      .set(PARENT)
      .send({ fullName: "Parent Insert", email: `p.${tag}@school.edu`, password })
      .expect(403);
  });

  test("unauthenticated create returns 401", async () => {
    await request(app)
      .post("/api/parents")
      .send({ fullName: "Anonymous", email: `n.${tag}@school.edu`, password })
      .expect(401);
  });

  test("PATCH renames and expands the child list", async () => {
    const res = await request(app)
      .patch(`/api/parents/${ref}`)
      .set(PRINCIPAL)
      .send({ fullName: `Renamed ${tag}`, studentIds: [childId, otherChild] })
      .expect(200);
    expect(res.body.full_name).toBe(`Renamed ${tag}`);

    const list = await request(app).get("/api/parents").set(PRINCIPAL).expect(200);
    expect(list.body.find((p) => p.email === email).children).toBe(2);
  });

  test("PATCH with an empty child list unlinks everyone", async () => {
    await request(app)
      .patch(`/api/parents/${ref}`)
      .set(PRINCIPAL)
      .send({ studentIds: [] })
      .expect(200);
    const { rows } = await pool.query(
      "select count(*)::int as n from public.students where parent_email = $1", [email]
    );
    expect(rows[0].n).toBe(0);
  });

  test("PATCH with no updatable fields returns 400", async () => {
    await request(app).patch(`/api/parents/${ref}`).set(PRINCIPAL).send({}).expect(400);
  });

  test("PATCH on an unknown parent returns 404", async () => {
    await request(app)
      .patch("/api/parents/nobody%40nowhere.com")
      .set(PRINCIPAL)
      .send({ fullName: "Ghost" })
      .expect(404);
  });

  test("DELETE removes the account and leaves no dangling child links", async () => {
    await request(app)
      .patch(`/api/parents/${ref}`)
      .set(PRINCIPAL)
      .send({ studentIds: [childId] })
      .expect(200);

    await request(app).delete(`/api/parents/${ref}`).set(PRINCIPAL).expect(200);

    const { rows: user } = await pool.query("select 1 from public.users where email = $1", [email]);
    expect(user).toHaveLength(0);
    const { rows: linked } = await pool.query(
      "select 1 from public.students where parent_email = $1", [email]
    );
    expect(linked).toHaveLength(0);
  });

  test("DELETE on an unknown parent returns 404", async () => {
    await request(app).delete("/api/parents/nobody%40nowhere.com").set(PRINCIPAL).expect(404);
  });

  test("invalid email in the path returns 400", async () => {
    await request(app).delete("/api/parents/not-an-email").set(PRINCIPAL).expect(400);
  });
});
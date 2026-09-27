/**
 * Add Student flow: POST /api/students (principal-only, validation, RBAC).
 * Rows are created through the API and cleaned up by roll_no marker.
 */
const { request, app, pool, TEACHER, PARENT, uniqueTag } = require("./helpers");

describe("POST /api/students — create student", () => {
  const tag = uniqueTag();
  const roll = `API-${tag}`;
  let classId;

  beforeAll(async () => {
    const { rows } = await pool.query("select id from public.classes limit 1");
    classId = rows[0].id;
  });

  afterAll(async () => {
    await pool.query("delete from public.students where roll_no = $1", [roll]);
    await pool.query("delete from public.students where roll_no = $1", [`DUP-${tag}`]);
  });

  test("principal creates a student (201) with returned class name", async () => {
    const res = await request(app)
      .post("/api/students")
      .set({ "x-demo-email": "principal@school.edu", "x-demo-role": "principal" })
      .send({ rollNo: roll, fullName: `API Student ${tag}`, classId, parentEmail: "parent.demo@mail.com" })
      .expect(201);
    expect(res.body.roll_no).toBe(roll);
    expect(res.body.full_name).toBe(`API Student ${tag}`);
    expect(res.body.class_name).toBeTruthy();
    expect(res.body.parent_email).toBe("parent.demo@mail.com");

    // row is queryable through GET /api/students
    const list = await request(app)
      .get("/api/students")
      .set({ "x-demo-email": "principal@school.edu", "x-demo-role": "principal" })
      .expect(200);
    expect(list.body.some((s) => s.roll_no === roll)).toBe(true);
  });

  test("duplicate roll number returns 409", async () => {
    const res = await request(app)
      .post("/api/students")
      .set({ "x-demo-email": "principal@school.edu", "x-demo-role": "principal" })
      .send({ rollNo: roll, fullName: "Duplicate", classId })
      .expect(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  test("missing roll number returns 400", async () => {
    await request(app)
      .post("/api/students")
      .set({ "x-demo-email": "principal@school.edu", "x-demo-role": "principal" })
      .send({ fullName: "No Roll", classId })
      .expect(400);
  });

  test("malformed parent email returns 400", async () => {
    await request(app)
      .post("/api/students")
      .set({ "x-demo-email": "principal@school.edu", "x-demo-role": "principal" })
      .send({ rollNo: `BAD-${tag}`, fullName: "Bad Email", classId, parentEmail: "not-an-email" })
      .expect(400);
  });

  test("teacher cannot create students (403)", async () => {
    await request(app)
      .post("/api/students")
      .set(TEACHER)
      .send({ rollNo: `T-${tag}`, fullName: "Teacher Insert", classId })
      .expect(403);
  });

  test("parent cannot create students (403)", async () => {
    await request(app)
      .post("/api/students")
      .set(PARENT)
      .send({ rollNo: `P-${tag}`, fullName: "Parent Insert", classId })
      .expect(403);
  });

  test("unauthenticated create returns 401", async () => {
    await request(app)
      .post("/api/students")
      .send({ rollNo: `N-${tag}`, fullName: "Anonymous", classId })
      .expect(401);
  });

  test("GET /api/classes lists classes for authenticated users", async () => {
    const res = await request(app)
      .get("/api/classes")
      .set({ "x-demo-email": "principal@school.edu", "x-demo-role": "principal" })
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("name");
  });
});

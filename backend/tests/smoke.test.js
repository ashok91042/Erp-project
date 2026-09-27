/** Smoke suite: app boots, DB reachable, RBAC headers resolve correctly. */
const { request, app, pool, TEACHER } = require("./helpers");

describe("API smoke — boot & auth wiring", () => {
  test("GET / returns the service banner", async () => {
    const res = await request(app).get("/").expect(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.health).toBe("/api/health");
  });

  test("GET /api/health reports DB connectivity", async () => {
    const res = await request(app).get("/api/health").expect(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.db_time).toBeTruthy();
  });

  test("unknown route returns 404 JSON", async () => {
    const res = await request(app).get("/api/nope").expect(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test("demo headers resolve teacher identity from DB", async () => {
    const { rows } = await pool.query("select id from public.users where email = $1", ["lakshmi@school.edu"]);
    // submitting attendance with demo headers works => user resolved & role allowed
    const students = await request(app).get("/api/students").set(TEACHER).expect(200);
    const res = await request(app)
      .post("/api/attendance")
      .set(TEACHER)
      .send({
        date: "2099-03-01",
        records: [{ studentId: students.body[0].id, fnPresent: true, anPresent: true }],
      })
      .expect(200);
    expect(res.body.saved).toBe(1);
    expect(rows[0].id).toBeTruthy();
  });

  test("unauthenticated write attempt is rejected (401)", async () => {
    await request(app)
      .post("/api/attendance")
      .send({ date: "2099-03-01", records: [] })
      .expect(401);
  });

  test("unauthenticated read is also rejected (401)", async () => {
    await request(app).get("/api/students").expect(401);
  });
});
/** Rate limiting: strict per-route limiters on request submission & writes. */
// Small limits for fast tests (read at module load by rateLimit.js)
process.env.RL_REQUESTS_WINDOW_MS = "60000";
process.env.RL_REQUESTS_MAX = "2";
process.env.RL_WRITE_WINDOW_MS = "60000";
process.env.RL_WRITE_MAX = "3";
process.env.RL_GLOBAL_MAX = "1000"; // effectively off here
const { request, app, TEACHER, uniqueTag, getStudents } = require("./helpers");

describe("Rate limiting — strict route limiters", () => {
  test("POST /api/requests blocks the 3rd submission inside the window (429)", async () => {
    const tag = uniqueTag();
    const titles = [];
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      const title = `JEST-RL-${tag}-${i}`;
      titles.push(title);
      const res = await request(app)
        .post("/api/requests")
        .set(TEACHER)
        .send({ title });
      statuses.push(res.status);
      if (res.status === 201) {
        await request(app) // cleanup immediately via principal decide? simpler: direct delete below
          .get("/api/requests");
      }
    }
    expect(statuses).toEqual([201, 201, 429]);
    // cleanup created rows
    const { pool } = require("./helpers");
    for (const t of titles) await pool.query("delete from public.permission_requests where title = $1", [t]);
  });

  test("write limiter blocks excessive attendance submissions (429)", async () => {
    const students = await getStudents();
    const sid = students[0].id;
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post("/api/attendance")
        .set(TEACHER)
        .send({ date: "2099-06-01", records: [{ studentId: sid, fnPresent: true, anPresent: true }] });
      statuses.push(res.status);
    }
    // first 3 allowed by RL_WRITE_MAX=3, 4th blocked
    expect(statuses[statuses.length - 1]).toBe(429);
    const { pool } = require("./helpers");
    await pool.query("delete from public.attendance where att_date = '2099-06-01' and student_id = $1", [sid]);
  });
});
/** Global rate limiter test — isolated file so its tight env doesn't affect others. */
process.env.RL_GLOBAL_WINDOW_MS = "60000";
process.env.RL_GLOBAL_MAX = "3";
process.env.RL_WRITE_MAX = "1000";
process.env.RL_REQUESTS_MAX = "1000";
const { request, app } = require("./helpers");

describe("Rate limiting — global limiter", () => {
  test("4th request from the same IP inside the window is blocked (429)", async () => {
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      const res = await request(app).get("/api/health");
      statuses.push(res.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });
});
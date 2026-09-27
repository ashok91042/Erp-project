/**
 * Password login: POST /api/auth/login, GET /api/auth/session and
 * PATCH /api/auth/password. Covers correct/incorrect credentials, token
 * forgery & expiry, role scoping through the token and account enumeration
 * resistance.
 */
process.env.APP_JWT_SECRET = process.env.APP_JWT_SECRET || "test-app-secret-for-auth-suite";
process.env.RL_LOGIN_MAX = "1000"; // keep the login limiter out of the way here

const jwt = require("jsonwebtoken");
const { request, app, pool } = require("./helpers");

const PASSWORD = "demo1234";
const ACCOUNTS = [
  ["principal@school.edu", "principal"],
  ["lakshmi@school.edu", "teacher"],
  ["parent.demo@mail.com", "parent"],
];

const login = (email, password) =>
  request(app).post("/api/auth/login").send({ email, password });

const setPassword = async (email, plain) => {
  const bcrypt = require("bcryptjs");
  await pool.query("update public.users set password_hash = $1 where lower(email) = lower($2)", [
    await bcrypt.hash(plain, 4),
    email,
  ]);
};

const originalHashes = [];

beforeAll(async () => {
  const { rows } = await pool.query(
    "select email, password_hash from public.users where lower(email) = any($1)",
    [ACCOUNTS.map(([e]) => e)]
  );
  rows.forEach((r) => originalHashes.push([r.email, r.password_hash]));
  for (const [email] of ACCOUNTS) await setPassword(email, PASSWORD);
});

afterAll(async () => {
  for (const [email, hash] of originalHashes) {
    await pool.query("update public.users set password_hash = $1 where lower(email) = lower($2)", [hash, email]);
  }
});

describe("POST /api/auth/login", () => {
  test.each(ACCOUNTS)("%s can sign in and receives its real role", async (email, role) => {
    const res = await login(email, PASSWORD).expect(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe(role); // role comes from the DB, never the request
  });

  test("the token authenticates API calls", async () => {
    const { body } = await login("principal@school.edu", PASSWORD).expect(200);
    const res = await request(app)
      .get("/api/auth/session")
      .set("Authorization", `Bearer ${body.token}`)
      .expect(200);
    expect(res.body.user.email).toBe("principal@school.edu");
  });

  test("a parent token cannot reach a principal-only endpoint", async () => {
    const { body } = await login("parent.demo@mail.com", PASSWORD).expect(200);
    await request(app)
      .get("/api/teachers")
      .set("Authorization", `Bearer ${body.token}`)
      .expect(403);
  });

  test("wrong password is rejected (401)", async () => {
    const res = await login("principal@school.edu", "not-the-password").expect(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  test("unknown account gives the same generic error (no enumeration)", async () => {
    const res = await login("ghost@evil.io", PASSWORD).expect(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  test("email is matched case-insensitively", async () => {
    const res = await login("Principal@School.EDU", PASSWORD).expect(200);
    expect(res.body.user.email).toBe("principal@school.edu");
  });

  test("missing fields are rejected (400)", async () => {
    await request(app).post("/api/auth/login").send({ email: "principal@school.edu" }).expect(400);
    await request(app).post("/api/auth/login").send({ password: "abcd" }).expect(400);
  });
  test("a token signed with the wrong secret is rejected (401)", async () => {
    const forged = jwt.sign(
      { email: "principal@school.edu", role: "authenticated" },
      "attacker-secret",
      { expiresIn: "10m" }
    );
    await request(app).get("/api/auth/session").set("Authorization", `Bearer ${forged}`).expect(401);
  });

  test("an expired token is rejected (401)", async () => {
    const expired = jwt.sign(
      { email: "principal@school.edu", role: "principal" },
      process.env.APP_JWT_SECRET,
      { expiresIn: "-10s" }
    );
    await request(app).get("/api/auth/session").set("Authorization", `Bearer ${expired}`).expect(401);
  });

  test("a token claiming a higher role cannot escalate (role from the DB)", async () => {
    const escalate = jwt.sign(
      { email: "lakshmi@school.edu", role: "principal" },
      process.env.APP_JWT_SECRET,
      { expiresIn: "10m" }
    );
    await request(app)
      .get("/api/teachers") // principal-only
      .set("Authorization", `Bearer ${escalate}`)
      .expect(403);
  });

  test("an account without a password cannot sign in (401)", async () => {
    const email = `nopass.${Date.now()}@test.local`;
    const { rows } = await pool.query(
      "insert into public.users (email, full_name, role) values ($1, $2, 'parent') returning id",
      [email, "No Password"]
    );
    try {
      await login(email, PASSWORD).expect(401);
    } finally {
      await pool.query("delete from public.users where id = $1", [rows[0].id]);
    }
  });

  test("no credentials at all is rejected (401)", async () => {
    await request(app).get("/api/auth/session").expect(401);
  });
});

describe("PATCH /api/auth/password — change your own password", () => {
  test("requires the correct current password", async () => {
    const { body } = await login("parent.demo@mail.com", PASSWORD).expect(200);
    const auth = { Authorization: `Bearer ${body.token}` };
    await request(app)
      .patch("/api/auth/password")
      .set(auth)
      .send({ currentPassword: "wrong", newPassword: "brand-new-pass" })
      .expect(401);
    await request(app)
      .patch("/api/auth/password")
      .set(auth)
      .send({ currentPassword: PASSWORD, newPassword: "short" })
      .expect(400);
  });

  test("changes the password and the old one stops working", async () => {
    const NEW = "rotated-pass-9876";
    const { body } = await login("parent.demo@mail.com", PASSWORD).expect(200);
    await request(app)
      .patch("/api/auth/password")
      .set("Authorization", `Bearer ${body.token}`)
      .send({ currentPassword: PASSWORD, newPassword: NEW })
      .expect(200);
    await login("parent.demo@mail.com", PASSWORD).expect(401);
    await login("parent.demo@mail.com", NEW).expect(200);
  });

  test("requires authentication (401)", async () => {
    await request(app)
      .patch("/api/auth/password")
      .send({ currentPassword: PASSWORD, newPassword: "whatever-123" })
      .expect(401);
  });
});

/**
 * One-off helper: add the password_hash column and give the seeded demo
 * accounts a known password so POST /api/auth/login works out of the box.
 *
 *   node scripts/seed-passwords.js            # default password: demo1234
 *   node scripts/seed-passwords.js MyPass123  # custom password
 *
 * Safe to re-run: it only touches accounts whose hash is NULL (or the demo
 * accounts when a password is passed explicitly).
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const DEMO_EMAILS = ["principal@school.edu", "lakshmi@school.edu", "parent.demo@mail.com"];
const password = process.argv[2] || "demo1234";

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("alter table public.users add column if not exists password_hash text");

    const hash = await bcrypt.hash(password, 10);
    for (const email of DEMO_EMAILS) {
      const { rowCount } = await pool.query(
        "update public.users set password_hash = $1 where lower(email) = lower($2)",
        [hash, email]
      );
      console.log(`${rowCount ? "updated" : "skipped "} ${email}`);
    }
    const { rows } = await pool.query(
      "select email, password_hash from public.users order by email"
    );
    rows.forEach((u) =>
      console.log(`  ${u.email.padEnd(26)} ${u.password_hash ? "password set" : "NO PASSWORD"}`)
    );
  } catch (err) {
    console.error("ERR", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

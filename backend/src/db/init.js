const fs = require("fs");
const path = require("path");
const pool = require("./pool");

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, "..", "..", "sql", "schema.sql"), "utf8");
  try {
    await pool.query(sql);
    console.log("✔ Schema applied successfully (tables + RLS policies + seed data)");
  } catch (err) {
    console.error("✖ Schema failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
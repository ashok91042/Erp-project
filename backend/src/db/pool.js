require("dotenv").config();
const { Pool } = require("pg");

// Supabase session pooler — needs TLS
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

pool.on("error", (err) => console.error("[pg] idle client error", err.message));

module.exports = pool;
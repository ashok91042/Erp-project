require("dotenv").config();
const { Pool } = require("pg");

// Supabase session pooler — needs TLS
//
// Connection budget: on Vercel each warm function instance builds its OWN pool,
// so `max` is effectively multiplied by the number of concurrent instances.
// A generous `max` is what exhausts the database and turns every request into
// "too many clients already". Keep it small for serverless and raise it only
// on a direct (non-pooler) connection with real headroom. DB_POOL_MAX wins.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const poolMax = Number(process.env.DB_POOL_MAX) || (isServerless ? 5 : 10);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: poolMax,
});

pool.on("error", (err) => console.error("[pg] idle client error", err.message));

module.exports = pool;
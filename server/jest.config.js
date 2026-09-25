module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  // Real Postgres (Supabase) + real app instance; serialize suites to avoid
  // overlapping transactions on shared demo rows.
  maxWorkers: 1,
  // pg pool keeps handles open; force exit after suites complete
  forceExit: true,
  testTimeout: 30000,
};
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  // Resolves TEST_TEACHER_EMAIL (who currently owns a class) before any test
  // module loads, so teacher-scoped suites do not hard-code one demo teacher.
  globalSetup: "<rootDir>/tests/globalSetup.js",
  // Real Postgres (Supabase) + real app instance; serialize suites to avoid
  // overlapping transactions on shared demo rows.
  maxWorkers: 1,
  // pg pool keeps handles open; force exit after suites complete
  forceExit: true,
  testTimeout: 30000,
};
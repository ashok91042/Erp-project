/** Central rate-limit configuration (tunable via env for tests/deployment). */
const rateLimit = require("express-rate-limit");

const num = (name, def) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
};

const base = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests — slow down and retry later." },
};

module.exports = {
  globalLimiter: rateLimit({
    ...base,
    windowMs: num("RL_GLOBAL_WINDOW_MS", 15 * 60 * 1000),
    limit: num("RL_GLOBAL_MAX", 300),
  }),
  // Marks + attendance writes
  writeLimiter: rateLimit({
    ...base,
    windowMs: num("RL_WRITE_WINDOW_MS", 15 * 60 * 1000),
    limit: num("RL_WRITE_MAX", 100),
  }),
  // Permission-request submission & decisions (strictest: workflow abuse / spam)
  requestLimiter: rateLimit({
    ...base,
    windowMs: num("RL_REQUESTS_WINDOW_MS", 15 * 60 * 1000),
    limit: num("RL_REQUESTS_MAX", 20),
  }),
  // Credential stuffing / password guessing on /api/auth/login
  loginLimiter: rateLimit({
    ...base,
    windowMs: num("RL_LOGIN_WINDOW_MS", 15 * 60 * 1000),
    limit: num("RL_LOGIN_MAX", 10),
    message: { error: "Too many sign-in attempts — wait a few minutes and try again." },
  }),
};
const express = require("express");
const pool = require("../db/pool");
const { requireRole } = require("../middleware/auth");
const { UUID_RE } = require("../middleware/ownership");
const { requestLimiter } = require("../middleware/rateLimit");
const { sendRequestDecision } = require("../mailer");

const router = express.Router();

/** GET /api/requests — teachers see own, principal sees all (status filter optional) */
router.get("/", requireRole("teacher", "principal"), async (req, res) => {
  const { status } = req.query;
  const params = [];
  let where = "";
  if (req.user.role === "teacher") {
    params.push(req.user.id);
    where = `where r.teacher_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    where += (where ? " and" : " where") + ` r.status = $${params.length}`;
  }
  try {
    const { rows } = await pool.query(
      `select r.*, u.full_name as teacher_name, u.email as teacher_email
       from public.permission_requests r
       join public.users u on u.id = r.teacher_id
       ${where}
       order by r.created_at desc`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("[requests] list failed:", err.message);
    res.status(500).json({ error: "Failed to load requests" });
  }
});

/** POST /api/requests — teacher submits a request to the principal */
router.post("/", requestLimiter, requireRole("teacher"), async (req, res) => {
  const { title, description, requestType } = req.body || {};
  if (!title || typeof title !== "string" || title.trim().length === 0 || title.length > 200) {
    return res.status(400).json({ error: "title is required (max 200 chars)" });
  }
  if (description && (typeof description !== "string" || description.length > 2000)) {
    return res.status(400).json({ error: "description too long (max 2000 chars)" });
  }
  try {
    const { rows } = await pool.query(
      `insert into public.permission_requests (teacher_id, request_type, title, description)
       values ($1, $2, $3, $4) returning *`,
      [req.user.id, requestType || "general", title.trim(), description || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("[requests] create failed:", err.message);
    res.status(500).json({ error: "Failed to create request" });
  }
});

/**
 * PATCH /api/requests/:id/decide — principal approves or rejects.
 * Body: { action: 'approved' | 'rejected', note }
 * Notifies the requesting teacher by email.
 */
router.patch("/:id/decide", requestLimiter, requireRole("principal"), async (req, res) => {
  const { action, note } = req.body || {};
  if (!["approved", "rejected"].includes(action)) {
    return res.status(400).json({ error: "action must be 'approved' or 'rejected'" });
  }
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: "Invalid request id" });
  }
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `update public.permission_requests
       set status = $1, decided_by = $2, decided_at = now(), decision_note = $3
       where id = $4 and status = 'pending'
       returning *`,
      [action, req.user.id, note || null, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Request not found or already decided" });
    }
    const request = rows[0];
    const teacher = (await client.query("select email, full_name from public.users where id = $1", [request.teacher_id])).rows[0];

    res.json(request); // respond immediately; email is fire-and-forget
    try {
      await sendRequestDecision({ teacherEmail: teacher.email, title: request.title, status: action, note });
    } catch (e) {
      console.error("[requests] notify failed:", e.message);
    }
  } catch (err) {
    console.error("[requests] decide failed:", err.message);
    res.status(500).json({ error: "Failed to update request" });
  } finally {
    client.release();
  }
});

module.exports = router;
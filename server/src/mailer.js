const nodemailer = require("nodemailer");

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE) === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

/* ---------------- Sanitization (defense against SMTP header injection) ---------------- */

/** Strips CR/LF & control chars — prevents SMTP header injection (e.g. "Bcc:" smuggling). */
function sanitizeHeader(value) {
  return String(value ?? "")
    .replace(/[\r\n\x00-\x1F\x7F]+/g, " ")
    .trim()
    .slice(0, 320);
}

/** Escapes HTML entities — prevents content injection into HTML email bodies. */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/** Strict recipient validation — never pass unvalidated user input as an address. */
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "")) && !/[\r\n\x00-\x1F]/.test(String(value || ""));
}

/* ---------------- Email builders (pure — unit-testable) ---------------- */

function buildAbsenceMail({ studentName, rollNo, date, session, parentEmail }) {
  const name = sanitizeHeader(studentName);
  const roll = sanitizeHeader(rollNo);
  const day = sanitizeHeader(date);
  const label = session === "both" ? "Full Day (FN & AN)" : session === "fn" ? "Forenoon (FN)" : "Afternoon (AN)";
  const to = isValidEmail(parentEmail) ? parentEmail : (isValidEmail(process.env.NOTIFY_EMAIL) ? process.env.NOTIFY_EMAIL : null);
  return {
    to,
    subject: sanitizeHeader(`Absence Alert — ${name} (${roll}) marked absent on ${day}`),
    html: `<h2 style="color:#b91c1c">Absence Notification</h2>
      <p><b>${escapeHtml(name)}</b> (Roll No: ${escapeHtml(roll)}) was marked <b style="color:#b91c1c">ABSENT</b>.</p>
      <ul><li>Date: <b>${escapeHtml(day)}</b></li><li>Session: <b>${escapeHtml(label)}</b></li></ul>
      <p>Please contact the class teacher if this was unexpected.</p>`,
  };
}

function buildDecisionMail({ teacherEmail, title, status, note }) {
  const to = isValidEmail(teacherEmail) ? teacherEmail : null;
  const t = sanitizeHeader(title);
  const n = sanitizeHeader(note || "");
  return {
    to,
    subject: sanitizeHeader(`Permission Request ${status === "approved" ? "Approved" : "Rejected"} — ${t}`),
    html: `<p>Your request <b>"${escapeHtml(title)}"</b> has been <b>${escapeHtml(status)}</b> by the Principal.</p>${note ? `<p>Note: ${escapeHtml(note)}</p>` : ""}`,
  };
}

/* ---------------- Senders ---------------- */

async function sendAbsenceAlert(params) {
  const mail = buildAbsenceMail(params);
  if (!transporter) {
    console.log(`[mailer:dev] Absence alert for ${sanitizeHeader(params.studentName)} (${sanitizeHeader(params.rollNo)}) — ${sanitizeHeader(params.date)} → ${mail.to || "no recipient"}`);
    return { sent: false, dev: true };
  }
  if (!mail.to) {
    console.warn("[mailer] No valid recipient for absence alert — suppressed");
    return { sent: false, reason: "no-recipient" };
  }
  const info = await transporter.sendMail({
    from: sanitizeHeader(process.env.MAIL_FROM || process.env.SMTP_USER),
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
  });
  console.log(`[mailer] Absence alert sent to ${mail.to} (${info.messageId})`);
  return { sent: true, messageId: info.messageId };
}

async function sendRequestDecision(params) {
  const mail = buildDecisionMail(params);
  if (!transporter) {
    console.log(`[mailer:dev] Request "${sanitizeHeader(params.title)}" ${sanitizeHeader(params.status)} → ${mail.to || "no recipient"}`);
    return { sent: false, dev: true };
  }
  if (!mail.to) {
    console.warn("[mailer] No valid recipient for decision notice — suppressed");
    return { sent: false, reason: "no-recipient" };
  }
  const info = await transporter.sendMail({
    from: sanitizeHeader(process.env.MAIL_FROM || process.env.SMTP_USER),
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
  });
  return { sent: true, messageId: info.messageId };
}

module.exports = { sendAbsenceAlert, sendRequestDecision, sanitizeHeader, escapeHtml, isValidEmail, buildAbsenceMail, buildDecisionMail };
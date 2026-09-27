/**
 * Role-scoped notification feed.
 *
 * The bell dropdown and each role's /notifications page both render from here so
 * the two can never drift apart. Items are derived from data the caller is
 * already allowed to read (absences come scoped from /api/stats), so no new
 * endpoint or notification table is required.
 */
const fmt = (d) => {
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? ""
    : t.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const MORE_URL = {
  principal: "/principal/requests",
  teacher: "/teacher/notifications",
  parent: "/parent/notifications",
};

export function buildFeed(role, { stats, requests, marks } = {}) {
  const abs = stats?.absences || [];

  if (role === "parent") {
    return [
      ...abs.map((a) => ({
        key: `abs-${a.student}-${a.date}-${a.session}`,
        type: "alert",
        title: `Absence Alert — ${a.student}`,
        text: "Your child was marked absent.",
        time: fmt(a.date),
      })),
      ...(marks || []).map((m) => ({
        key: `mark-${m.id}`,
        type: "info",
        title: `${m.subject} result published`,
        text: `${m.full_name} scored ${m.score}/${m.max_score} in ${m.exam_name}.`,
        time: fmt(m.created_at),
      })),
    ];
  }

  if (role === "teacher") {
    return [
      ...abs.map((a) => ({
        key: `abs-${a.student}-${a.date}-${a.session}`,
        type: "alert",
        title: `Absence — ${a.student}`,
        text: `${a.student} was marked absent (${a.session}) in your class.`,
        time: fmt(a.date),
      })),
      ...(requests || []).map((r) => ({
        key: `req-${r.id}`,
        type: r.status === "approved" ? "success" : r.status === "rejected" ? "alert" : "info",
        title: `Request ${r.status}: ${r.title}`,
        text: r.decision_note || r.description || "Awaiting Principal decision.",
        time: fmt(r.created_at),
      })),
    ];
  }

  // Principal: pending approvals are the actionable signal, so they lead.
  return [
    ...(requests || []).map((r) => ({
      key: `req-${r.id}`,
      type: r.status === "pending" ? "alert" : r.status === "approved" ? "success" : "info",
      title: `${r.status === "pending" ? "New request" : `Request ${r.status}`}: ${r.title}`,
      text: `${r.teacher_name}${r.decision_note ? ` — ${r.decision_note}` : ""}`,
      time: fmt(r.created_at),
    })),
    ...abs.map((a) => ({
      key: `abs-${a.student}-${a.date}-${a.session}`,
      type: "alert",
      title: `Absence — ${a.student}`,
      text: `Marked absent (${a.session}).`,
      time: fmt(a.date),
    })),
  ];
}

/** localStorage-backed read state, namespaced per user so accounts don't share. */
const readKey = (uid) => `academicerp:notif-read:${uid || "anon"}`;

export function loadRead(uid) {
  try {
    const arr = JSON.parse(localStorage.getItem(readKey(uid)) || "[]");
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

export function saveRead(uid, set) {
  try {
    localStorage.setItem(readKey(uid), JSON.stringify([...set]));
  } catch {
    /* private mode / quota — the badge simply resets on the next load */
  }
}
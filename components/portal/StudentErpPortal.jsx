"use client";

import { useMemo, useState } from "react";
import { CheckCheck, CheckCircle2, GraduationCap, RotateCcw, XCircle } from "lucide-react";

/* ---------------- JSON Mock State ---------------- */
const ROLES = ["Principal", "Teacher", "Parent"];

const MOCK_STUDENTS = [
  { id: "101", roll: "10A-01", name: "Aarav Kumar",  fn: true,  an: true,  remarks: "-" },
  { id: "102", roll: "10A-02", name: "Ananya Reddy", fn: true,  an: false, remarks: "Sick leave" },
  { id: "103", roll: "10A-03", name: "Rahul Verma",  fn: false, an: true,  remarks: "-" },
  { id: "104", roll: "10A-04", name: "Sneha Nair",   fn: true,  an: true,  remarks: "-" },
  { id: "105", roll: "10A-05", name: "Karthik S",    fn: true,  an: true,  remarks: "-" },
  { id: "106", roll: "10A-06", name: "Diya Sharma",  fn: true,  an: false, remarks: "-" },
  { id: "107", roll: "10A-07", name: "Aditya Rao",   fn: false, an: false, remarks: "Absent" },
  { id: "108", roll: "10A-08", name: "Meera Iyer",   fn: true,  an: true,  remarks: "-" },
];

const CLASS = { grade: "Class 10A", teacher: "Mrs. Lakshmi Menon", date: "25 September 2026" };

/* ---------------- Pieces ---------------- */
function PresenceToggle({ present, onClick }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={present}
      onClick={onClick}
      className={`inline-flex w-[92px] items-center gap-1.5 rounded-full px-1.5 py-1.5 text-xs font-black transition-all
        ${present
          ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-200"
          : "bg-red-100 text-red-700 ring-1 ring-red-300 hover:bg-red-200"}`}
      title={present ? "Present — click to mark Absent" : "Absent — click to mark Present"}
    >
      <span className={`grid h-5 w-5 place-items-center rounded-full text-white ${present ? "bg-emerald-500" : "bg-red-500"}`}>
        {present ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      </span>
      <span>{present ? "Present" : "Absent"}</span>
    </button>
  );
}

function BatchButton({ label, present, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black text-white transition
        ${present ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
    >
      <CheckCheck size={14} /> {label}
    </button>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

/* ---------------- Main Component ---------------- */
export default function StudentErpPortal() {
  const [role, setRole] = useState("Teacher");
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [saved, setSaved] = useState(false);

  const stats = useMemo(() => {
    const fnPresent = students.filter((s) => s.fn).length;
    const anPresent = students.filter((s) => s.an).length;
    const bothAbsent = students.filter((s) => !s.fn && !s.an).length;
    return { fnPresent, anPresent, bothAbsent, total: students.length };
  }, [students]);

  const toggle = (id, key) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [key]: !s[key] } : s))
    );
    setSaved(false);
  };

  const markAll = (key, present) => {
    setStudents((prev) => prev.map((s) => ({ ...s, [key]: present })));
    setSaved(false);
  };

  const setRemarks = (id, remarks) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, remarks } : s))
    );
    setSaved(false);
  };

  const handleSave = () => {
    // Trigger for FN/AN absence email notifications (mock)
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-white">
              <GraduationCap size={24} />
            </span>
            <div>
              <h1 className="text-lg font-black text-slate-900">{CLASS.grade} — Attendance</h1>
              <p className="text-sm text-slate-500">
                {CLASS.teacher} · {CLASS.date}
              </p>
            </div>
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Students" value={stats.total} tone="text-slate-900" />
          <StatCard label="FN Present" value={`${stats.fnPresent}/${stats.total}`} tone="text-emerald-600" />
          <StatCard label="AN Present" value={`${stats.anPresent}/${stats.total}`} tone="text-emerald-600" />
          <StatCard label="Full-Day Absent" value={stats.bothAbsent} tone="text-red-600" />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <BatchButton label="All FN Present" present onClick={() => markAll("fn", true)} />
            <BatchButton label="All FN Absent" present={false} onClick={() => markAll("fn", false)} />
            <BatchButton label="All AN Present" present onClick={() => markAll("an", true)} />
            <BatchButton label="All AN Absent" present={false} onClick={() => markAll("an", false)} />
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-indigo-700"
          >
            {saved ? <CheckCircle2 size={16} /> : <RotateCcw size={16} />}
            {saved ? "Saved!" : "Save & Notify"}
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Roll No</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">FN</th>
                  <th className="px-4 py-3">AN</th>
                  <th className="px-4 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold">{s.roll}</td>
                    <td className="px-4 py-3 font-semibold">{s.name}</td>
                    <td className="px-4 py-3">
                      <PresenceToggle present={s.fn} onClick={() => toggle(s.id, "fn")} />
                    </td>
                    <td className="px-4 py-3">
                      <PresenceToggle present={s.an} onClick={() => toggle(s.id, "an")} />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={s.remarks}
                        onChange={(e) => setRemarks(s.id, e.target.value)}
                        className="w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
                        placeholder="Add remarks"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {saved && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
            Attendance saved. Email notifications queued for FN/AN absences (mock).
          </p>
        )}
      </div>
    </div>
  );
}
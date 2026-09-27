"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCheck, CheckCircle2, GraduationCap, RotateCcw, XCircle } from "lucide-react";
import { getAttendance, saveAttendance, getClasses } from "@/lib/api";

/* Standalone attendance board backed by the real API — the caller's role scopes
   the roster exactly like the rest of the app (principal sees every class). */
const Toggle = ({ present, onClick }) => (
  <button type="button" role="switch" aria-checked={present} onClick={onClick}
    title={present ? "Present — click to mark Absent" : "Absent — click to mark Present"}
    className={`inline-flex w-[92px] items-center gap-1.5 rounded-full px-1.5 py-1.5 text-xs font-black transition-all ${present ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300" : "bg-red-100 text-red-700 ring-1 ring-red-300"}`}>
    <span className={`grid h-5 w-5 place-items-center rounded-full text-white ${present ? "bg-emerald-500" : "bg-red-500"}`}>
      {present ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
    </span>
    {present ? "Present" : "Absent"}
  </button>
);

const Batch = ({ label, present, onClick }) => (
  <button type="button" onClick={onClick}
    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black text-white transition ${present ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
    <CheckCheck size={14} /> {label}
  </button>
);

const Stat = ({ label, value, tone }) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p>
  </div>
);

export default function StudentErpPortal() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getClasses().then(setClasses).catch(() => setClasses([])); }, []);

  useEffect(() => {
    setStatus(""); setSaved(false);
    getAttendance(date)
      .then((d) => setStudents(d.rows.map((r) => ({
        id: r.id, roll: r.roll_no, name: r.full_name, klass: r.class_name,
        fn: r.fn_present, an: r.an_present, remarks: r.remarks,
      }))))
      .catch((e) => setStatus(`Load failed: ${e.message}`));
  }, [date]);

  const stats = useMemo(() => ({
    fnPresent: students.filter((s) => s.fn).length,
    anPresent: students.filter((s) => s.an).length,
    bothAbsent: students.filter((s) => !s.fn && !s.an).length,
    total: students.length,
  }), [students]);

  const patch = (id, fn) => setStudents((p) => p.map((s) => (s.id === id ? { ...s, [fn]: !s[fn] } : s)));
  const markAll = (k, v) => { setStudents((p) => p.map((s) => ({ ...s, [k]: v }))); setSaved(false); };
  const setRemarks = (id, r) => setStudents((p) => p.map((s) => (s.id === id ? { ...s, remarks: r } : s)));

  const handleSave = async () => {
    setBusy(true); setStatus("");
    try {
      const res = await saveAttendance({
        date,
        records: students.map((s) => ({ studentId: s.id, fnPresent: s.fn, anPresent: s.an, remarks: s.remarks })),
      });
      setSaved(true);
      setStatus(`Saved ${res.saved} record(s) — ${res.absentees} absence alert(s) queued.`);
    } catch (e) { setStatus(`Save failed: ${e.message}`); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-white"><GraduationCap size={24} /></span>
            <div>
              <h1 className="text-lg font-black text-slate-900">Attendance Board</h1>
              <p className="text-sm text-slate-500">{classes.length ? classes.map((c) => c.name).join(", ") : "All classes"} · live from the database</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" />
            <Link href="/teacher/attendance" className="rounded-xl border px-3 py-2 text-sm font-semibold text-slate-700">Full app</Link>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="FN Present" value={`${stats.fnPresent}/${stats.total}`} tone="text-emerald-600" />
          <Stat label="AN Present" value={`${stats.anPresent}/${stats.total}`} tone="text-emerald-600" />
          <Stat label="Full-Day Absent" value={stats.bothAbsent} tone="text-red-600" />
          <Stat label="Students" value={stats.total} tone="text-slate-800" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Batch label="All FN Present" present onClick={() => markAll("fn", true)} />
            <Batch label="All FN Absent" present={false} onClick={() => markAll("fn", false)} />
            <Batch label="All AN Present" present onClick={() => markAll("an", true)} />
            <Batch label="All AN Absent" present={false} onClick={() => markAll("an", false)} />
          </div>
          <button type="button" onClick={handleSave} disabled={busy || !students.length}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-indigo-700 disabled:opacity-60">
            {saved ? <CheckCircle2 size={16} /> : <RotateCcw size={16} />}
            {busy ? "Saving…" : saved ? "Saved!" : "Save & Notify"}
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Roll No</th><th className="px-4 py-3">Student Name</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">FN</th><th className="px-4 py-3">AN</th><th className="px-4 py-3">Remarks</th></tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold">{s.roll}</td>
                    <td className="px-4 py-3 font-semibold">{s.name}</td>
                    <td className="px-4 py-3 text-slate-500">{s.klass}</td>
                    <td className="px-4 py-3"><Toggle present={s.fn} onClick={() => patch(s.id, "fn")} /></td>
                    <td className="px-4 py-3"><Toggle present={s.an} onClick={() => patch(s.id, "an")} /></td>
                    <td className="px-4 py-3">
                      <input type="text" value={s.remarks} onChange={(e) => setRemarks(s.id, e.target.value)}
                        className="w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" placeholder="Add remarks" />
                    </td>
                  </tr>
                ))}
                {students.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No students in scope for this date.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {status && (
          <p className={`rounded-xl px-4 py-3 text-sm font-semibold ring-1 ${status.startsWith("Save failed") ? "bg-red-50 text-red-700 ring-red-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}

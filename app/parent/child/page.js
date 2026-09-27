"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { getStudents, getAttendance, getMarks } from '@/lib/api';

export default function Child() {
  const [children, setChildren] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [attendanceToday, setAttendanceToday] = useState(null);
  const [childMarks, setChildMarks] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  // The API scopes a parent to their own children (students.parent_email),
  // so this list is already the parent's children — no client-side filtering.
  useEffect(() => {
    (async () => {
      try {
        const students = await getStudents();
        setChildren(students);
        if (students.length) setActiveId(students[0].id);
      } catch (e) { setErr(e.message); } finally { setLoading(false); }
    })();
  }, []);

  const child = children.find((c) => c.id === activeId) || children[0] || null;

  useEffect(() => {
    if (!child) return;
    (async () => {
      try {
        const [att, marks] = await Promise.all([
          getAttendance(new Date().toISOString().slice(0, 10)),
          getMarks(),
        ]);
        setAttendanceToday(att.rows.find((r) => r.id === child.id) || null);
        setChildMarks(marks.filter((m) => m.student_id === child.id));
      } catch (e) { setErr(e.message); }
    })();
  }, [child]);

  if (err) return <AppShell role="parent" title="My Child"><p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p></AppShell>;
  if (loading) return <AppShell role="parent" title="My Child"><p className="text-slate-500">Loading…</p></AppShell>;
  if (!child) return <AppShell role="parent" title="My Child"><p className="rounded-xl bg-white p-8 text-center text-slate-400 ring-1 ring-slate-200">No children are linked to this account yet — ask the principal to set a student&apos;s parent email to your account.</p></AppShell>;

  const initials = child.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <AppShell role="parent" title="My Child">
      {children.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {children.map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)} className={`rounded-xl px-4 py-2 text-sm font-bold ${c.id === child.id ? 'bg-red-600 text-white' : 'border bg-white'}`}>{c.full_name}</button>
          ))}
        </div>
      )}
      <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-red-100 text-xl font-black text-red-700">{initials}</div>
          <div>
            <h2 className="text-2xl font-black">{child.full_name}</h2>
            <p className="text-sm text-slate-500">{child.class_name} • Roll No {child.roll_no}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Attendance Today</div><div className="mt-1 text-2xl font-black">{attendanceToday ? (attendanceToday.fn_present && attendanceToday.an_present ? 'Present' : attendanceToday.fn_present || attendanceToday.an_present ? 'Partial' : 'Absent') : '—'}</div></div>
          <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">FN / AN</div><div className="mt-1 text-2xl font-black">{attendanceToday ? `${attendanceToday.fn_present ? 'P' : 'A'} / ${attendanceToday.an_present ? 'P' : 'A'}` : '—'}</div></div>
          <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Exams Recorded</div><div className="mt-1 text-2xl font-black">{childMarks.length}</div></div>
        </div>
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Exam</th><th className="px-4 py-3">Score</th></tr></thead>
            <tbody>
              {childMarks.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{m.subject}</td>
                  <td className="px-4 py-3 text-slate-500">{m.exam_name}</td>
                  <td className="px-4 py-3 font-black text-red-600">{m.score} / {m.max_score}</td>
                </tr>
              ))}
              {childMarks.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">No marks recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}


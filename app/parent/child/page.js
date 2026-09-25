"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { getStudents, getAttendance, getMarks } from '@/lib/api';

export default function Child() {
  const [child, setChild] = useState(null);
  const [attendanceToday, setAttendanceToday] = useState(null);
  const [marksCount, setMarksCount] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // Demo: show the first student as "my child" (link parent->student by email in production)
        const students = await getStudents();
        const c = students.find((s) => s.roll_no === '10A-06') || students[0];
        setChild(c);
        if (c) {
          const att = await getAttendance(new Date().toISOString().slice(0, 10));
          const row = att.rows.find((r) => r.id === c.id);
          setAttendanceToday(row || null);
          const marks = await getMarks();
          setMarksCount(marks.filter((m) => m.student_id === c.id).length);
        }
      } catch (e) { setErr(e.message); }
    })();
  }, []);

  if (err) return <AppShell role="parent" title="My Child"><p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p></AppShell>;
  if (!child) return <AppShell role="parent" title="My Child"><p className="text-slate-500">Loading…</p></AppShell>;

  const initials = child.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <AppShell role="parent" title="My Child">
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
          <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Exams Recorded</div><div className="mt-1 text-2xl font-black">{marksCount}</div></div>
        </div>
      </div>
    </AppShell>
  );
}

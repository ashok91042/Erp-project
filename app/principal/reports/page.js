"use client";
import AppShell from '@/components/AppShell';
import { AttendanceChart, MonthlyChart, StrengthChart } from '@/components/ChartPanels';
import { useEffect, useState } from 'react';
import { getStats, getStudents, getMarks } from '@/lib/api';

const toCsv = (rows) =>
  rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

const download = (name, text) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

export default function Reports() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { getStats().then(setStats).catch((e) => setErr(e.message)); }, []);

  const exportStudents = async () => {
    try {
      const students = await getStudents();
      download('students.csv', toCsv([['Roll No', 'Student', 'Class', 'Parent'], ...students.map((s) => [s.roll_no, s.full_name, s.class_name, s.parent_email || ''])]));
      setMsg(`Exported ${students.length} student(s).`);
    } catch (e) { setErr(e.message); }
  };

  const exportMarks = async () => {
    try {
      const marks = await getMarks();
      download('marks.csv', toCsv([['Roll No', 'Student', 'Subject', 'Exam', 'Score', 'Max'], ...marks.map((m) => [m.roll_no, m.full_name, m.subject, m.exam_name, m.score, m.max_score])]));
      setMsg(`Exported ${marks.length} mark entry(ies).`);
    } catch (e) { setErr(e.message); }
  };

  const exportAttendance = () => {
    const trend = stats?.attendanceTrend || [];
    download('attendance-trend.csv', toCsv([['Date', 'Present %'], ...trend.map((t) => [t.date, t.pct])]));
    setMsg(`Exported ${trend.length} attendance day(s).`);
  };

  // Browser print dialog is the reliable, dependency-free "Export PDF".
  const exportPdf = () => { setMsg('Opening the print dialog — choose "Save as PDF".'); setTimeout(() => window.print(), 250); };

  return (
    <AppShell role="principal" title="Reports">
      <div className="mb-5">
        <h2 className="text-2xl font-black">Reports & Analytics</h2>
        <p className="text-sm text-slate-500">Institution-level performance snapshots — live from the database.</p>
      </div>
      {err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p>}
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{msg}</p>}
      <div className="grid gap-5 xl:grid-cols-2">
        <AttendanceChart data={stats?.attendanceTrend} />
        <StrengthChart items={stats?.classStrength} />
        <MonthlyChart data={stats?.attendanceTrend} />
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-black">Export Reports</h3>
          <p className="mt-1 text-sm text-slate-500">Download real academic/attendance data as CSV, or print to PDF.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={exportPdf} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white">Export PDF</button>
            <button onClick={exportStudents} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Students CSV</button>
            <button onClick={exportMarks} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Marks CSV</button>
            <button onClick={exportAttendance} disabled={!stats?.attendanceTrend?.length} className="rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-50">Attendance CSV</button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Students', stats?.students], ['Teachers', stats?.teachers], ['Classes', stats?.classes], ['Pending', stats?.pendingRequests]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-xs text-slate-500">{k}</div>
                <div className="text-xl font-black">{v == null ? '—' : v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}


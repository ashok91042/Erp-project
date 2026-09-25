"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { MonthlyChart } from '@/components/ChartPanels';
import { getAttendance } from '@/lib/api';

export default function Attendance() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await getAttendance(new Date().toISOString().slice(0, 10));
        setRows(data.rows);
      } catch (e) { setErr(e.message); }
    })();
  }, []);

  const fnPct = rows.length ? Math.round((rows.filter((r) => r.fn_present).length / rows.length) * 100) : 0;
  const anPct = rows.length ? Math.round((rows.filter((r) => r.an_present).length / rows.length) * 100) : 0;

  return (
    <AppShell role="parent" title="Attendance">
      <div className="mb-5">
        <h2 className="text-2xl font-black">Attendance</h2>
        <p className="text-sm text-slate-500">Class 10A · Today ({new Date().toLocaleDateString()})</p>
      </div>
      {err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p>}
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">FN Present</div><div className="mt-1 text-2xl font-black text-emerald-600">{fnPct}%</div></div>
        <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">AN Present</div><div className="mt-1 text-2xl font-black text-emerald-600">{anPct}%</div></div>
        <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Students</div><div className="mt-1 text-2xl font-black">{rows.length}</div></div>
      </div>
      <MonthlyChart />
      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Roll No</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">FN</th><th className="px-4 py-3">AN</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold">{r.roll_no}</td>
                <td className="px-4 py-3 font-semibold">{r.full_name}</td>
                <td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-xs font-black ${r.fn_present ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.fn_present ? 'P' : 'A'}</span></td>
                <td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-xs font-black ${r.an_present ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.an_present ? 'P' : 'A'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

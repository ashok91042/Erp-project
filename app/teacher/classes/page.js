"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { getClasses, getStats } from '@/lib/api';

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    getClasses().then(setClasses).catch((e) => setErr(e.message));
    getStats().then(setStats).catch(() => {});
  }, []);

  return (
    <AppShell role="teacher" title="My Classes">
      <div className="mb-5"><h2 className="text-2xl font-black">My Classes</h2><p className="text-sm text-slate-500">Assigned classes and live attendance health.</p></div>
      {err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {classes.map((c) => (
          <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="text-xl font-black">{c.name}</div>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Active</span>
            </div>
            <div className="mt-3 text-sm text-slate-500">{c.student_count} students{c.teacher_name ? ` • ${c.teacher_name}` : ''}</div>
            <div className="mt-5 text-xs text-slate-500">Attendance today</div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${stats?.attendanceTodayPct ?? 0}%` }} />
            </div>
            <div className="mt-2 text-right text-xs font-bold">{stats?.attendanceTodayPct == null ? 'Not marked yet' : `${stats.attendanceTodayPct}%`}</div>
          </div>
        ))}
        {classes.length === 0 && !err && (
          <p className="rounded-2xl bg-white p-8 text-center text-slate-400 ring-1 ring-slate-200 md:col-span-2 xl:col-span-3">No classes assigned to you yet.</p>
        )}
      </div>
    </AppShell>
  );
}


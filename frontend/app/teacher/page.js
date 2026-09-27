"use client";
import AppShell from '@/components/AppShell';
import DashboardCard from '@/components/DashboardCard';
import { BookOpen, GraduationCap, CalendarCheck, Clock3 } from 'lucide-react';
import { AttendanceChart } from '@/components/ChartPanels';
import { useEffect, useState } from 'react';
import { getStats, getClasses } from '@/lib/api';

export default function Teacher(){
  const [stats, setStats] = useState(null);
  const [classes, setClasses] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    getStats().then(setStats).catch((e) => setErr(e.message));
    getClasses().then(setClasses).catch(() => setClasses([]));
  }, []);
  const n = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'));
  return <AppShell role="teacher" title="Teacher Dashboard"><div className="mb-6"><p className="text-sm font-semibold text-red-600">Welcome{stats?.me?.name ? `, ${stats.me.name}` : ''} 👋</p><h2 className="mt-1 text-2xl font-black">Your teaching workspace</h2></div>{err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err} — is the API running?</p>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><DashboardCard title="My Classes" value={n(stats?.classes)} icon={BookOpen} tone="blue"/><DashboardCard title="Students" value={n(stats?.students)} note="in my classes" icon={GraduationCap} tone="green"/><DashboardCard title="Attendance Today" value={stats?.attendanceTodayPct != null ? `${stats.attendanceTodayPct}%` : '—'} note={stats?.attendanceTodayPct != null ? 'marked so far' : 'not marked yet'} icon={CalendarCheck} tone="green"/><DashboardCard title="Pending Requests" value={n(stats?.pendingRequests)} note={stats?.pendingRequests ? 'Awaiting principal' : 'All clear'} icon={Clock3} tone="amber"/></div><div className="mt-5 grid gap-5 xl:grid-cols-2"><AttendanceChart data={stats?.attendanceTrend}/><div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-black">My Classes</h3><div className="mt-4 space-y-3">{classes.map(c=><div key={c.id} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4"><div><b>{c.name}</b><div className="text-xs text-slate-500">{c.student_count} students</div></div><a href="/teacher/classes" className="text-xs font-bold text-red-600">Open →</a></div>)}{classes.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">No classes assigned.</p>}</div></div></div></AppShell>}

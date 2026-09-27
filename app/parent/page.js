"use client";
import AppShell from '@/components/AppShell';
import DashboardCard from '@/components/DashboardCard';
import { GraduationCap, CalendarCheck, Award, ClipboardList } from 'lucide-react';
import { MonthlyChart } from '@/components/ChartPanels';
import Notification from '@/components/Notification';
import { useEffect, useState } from 'react';
import { getStats } from '@/lib/api';

const gradeOf = (pct) => (pct == null ? '—' : pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : 'C');

export default function Parent(){
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { getStats().then(setStats).catch((e) => setErr(e.message)); }, []);
  const n = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'));
  const absences = (stats?.absences || []).slice(0, 3);
  return <AppShell role="parent" title="Parent Dashboard"><div className="mb-6"><p className="text-sm font-semibold text-red-600">Welcome{stats?.me?.name ? `, ${stats.me.name}` : ''}</p><h2 className="mt-1 text-2xl font-black">Your child’s academic progress</h2></div>{err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err} — is the API running?</p>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><DashboardCard title="Overall Grade" value={gradeOf(stats?.marks?.avg_pct)} note={stats?.marks?.avg_pct != null ? `${stats.marks.avg_pct}% average` : 'no marks yet'} icon={Award} tone="green"/><DashboardCard title="Attendance" value={stats?.attendanceTodayPct != null ? `${stats.attendanceTodayPct}%` : '—'} note="today" icon={CalendarCheck} tone="green"/><DashboardCard title="Total Subjects" value={n(stats?.marks?.subjects)} icon={GraduationCap} tone="blue"/><DashboardCard title="Exams Recorded" value={n(stats?.marks?.exams)} note="entries" icon={ClipboardList} tone="amber"/></div><div className="mt-5 grid gap-5 xl:grid-cols-2"><MonthlyChart data={stats?.attendanceTrend}/><div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-4 flex items-center justify-between"><h3 className="font-black">Recent Notifications</h3><a className="text-xs font-bold text-red-600" href="/parent/notifications">View all</a></div><div className="space-y-3">{absences.map((a,i)=><Notification key={i} type="alert" title="Absence Alert" text={`${a.student} was marked absent (${a.session}) on ${a.date}.`} time={a.date}/>) }{absences.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">No recent absences — all clear.</p>}</div></div></div></AppShell>}

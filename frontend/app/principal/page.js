"use client";
import AppShell from '@/components/AppShell';
import DashboardCard from '@/components/DashboardCard';
import { AttendanceChart, StrengthChart } from '@/components/ChartPanels';
import { Users, GraduationCap, UserRound, Clock3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getStats, getRequests } from '@/lib/api';

export default function PrincipalDashboard(){
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    getStats().then(setStats).catch((e) => setErr(e.message));
    getRequests().then((r) => setRequests(r.slice(0, 4))).catch(() => setRequests([]));
  }, []);
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const n = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'));
  return <AppShell role="principal" title="Principal Dashboard"><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-red-600">Welcome{stats?.me?.name ? `, ${stats.me.name}` : ''} 👋</p><h2 className="mt-1 text-2xl font-black">Institution overview</h2></div><span className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-500 shadow-sm">{today}</span></div>{err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err} — is the API running?</p>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><DashboardCard title="Total Students" value={n(stats?.students)} note="live from database" icon={GraduationCap} tone="green"/><DashboardCard title="Total Teachers" value={n(stats?.teachers)} note="active staff" icon={Users} tone="blue"/><DashboardCard title="Total Parents" value={n(stats?.parents)} note="linked accounts" icon={UserRound} tone="blue"/><DashboardCard title="Pending Approvals" value={n(stats?.pendingRequests)} note={stats?.pendingRequests ? 'Requires action' : 'All clear'} icon={Clock3} tone="amber"/></div><div className="mt-5 grid gap-5 xl:grid-cols-2"><AttendanceChart data={stats?.attendanceTrend}/><StrengthChart items={stats?.classStrength}/></div><div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-4 flex items-center justify-between"><h3 className="font-black">Recent Requests</h3><a className="text-xs font-bold text-red-600" href="/principal/requests">View all</a></div><div className="space-y-2">{requests.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><div className="text-sm font-bold">{r.title}</div><div className="text-xs text-slate-500">{r.teacher_name}</div></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span></div>)}{requests.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">No requests yet.</p>}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="font-black">Quick Actions</h3><div className="mt-4 grid grid-cols-2 gap-3">{[['Add Student','/principal/users'],['Add Teacher','/principal/teachers'],['Attendance','/principal/attendance'],['Reports','/principal/reports']].map(x=><a href={x[1]} key={x[0]} className="rounded-xl border border-slate-200 p-4 text-sm font-bold hover:border-red-200 hover:bg-red-50">{x[0]}<div className="mt-2 text-xs font-normal text-slate-500">Open workspace →</div></a>)}</div></div></div></AppShell>}

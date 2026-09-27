"use client";
import AppShell from '@/components/AppShell';
import { MonthlyChart } from '@/components/ChartPanels';
import { useEffect, useState } from 'react';
import { getAttendance, getClasses, getStats } from '@/lib/api';

export default function Attendance(){
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [klass, setKlass] = useState('all');
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { getClasses().then(setClasses).catch(() => setClasses([])); getStats().then(setStats).catch(() => {}); }, []);
  useEffect(() => {
    setLoading(true);
    getAttendance(date).then((d) => setRows(d.rows)).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [date]);

  const filtered = klass === 'all' ? rows : rows.filter((r) => r.class_name === klass);
  const present = filtered.filter((r) => r.fn_present && r.an_present).length;
  const absent = filtered.filter((r) => !r.fn_present && !r.an_present).length;
  const partial = filtered.length - present - absent;
  const pct = (v) => (filtered.length ? Math.round((v / filtered.length) * 100) : 0);

  return <AppShell role="principal" title="Attendance"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black">Attendance</h2><p className="text-sm text-slate-500">Institution attendance monitoring.</p></div><div className="flex flex-wrap gap-2"><select value={klass} onChange={(e) => setKlass(e.target.value)} className="rounded-xl border bg-white px-3 py-2"><option value="all">All classes</option>{classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border bg-white px-3 py-2"/></div></div>{err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p>}<div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-emerald-50 p-5"><div className="text-sm text-emerald-700">Present</div><div className="text-3xl font-black text-emerald-700">{pct(present)}%</div><div className="mt-1 text-xs text-emerald-600">{present} student(s)</div></div><div className="rounded-2xl bg-red-50 p-5"><div className="text-sm text-red-700">Absent</div><div className="text-3xl font-black text-red-700">{pct(absent)}%</div><div className="mt-1 text-xs text-red-600">{absent} student(s){partial > 0 ? ` · ${partial} partial` : ''}</div></div><div className="rounded-2xl bg-blue-50 p-5"><div className="text-sm text-blue-700">Students in view</div><div className="text-3xl font-black text-blue-700">{filtered.length}</div><div className="mt-1 text-xs text-blue-600">{klass === 'all' ? 'all classes' : klass} · {loading ? 'loading…' : date}</div></div></div><div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Roll No</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">FN</th><th className="px-4 py-3">AN</th><th className="px-4 py-3">Remarks</th></tr></thead><tbody>{filtered.map((r,i)=><tr key={r.id} className="border-t border-slate-100"><td className="px-4 py-3">{i+1}</td><td className="px-4 py-3 font-semibold">{r.roll_no}</td><td className="px-4 py-3 font-semibold">{r.full_name}</td><td className="px-4 py-3">{r.class_name || '—'}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-xs font-black ${r.fn_present ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.fn_present ? 'P' : 'A'}</span></td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-xs font-black ${r.an_present ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.an_present ? 'P' : 'A'}</span></td><td className="px-4 py-3 text-slate-500">{r.remarks}</td></tr>)}{filtered.length === 0 && !loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No attendance records for this date.</td></tr>}</tbody></table></div><div className="mt-5"><MonthlyChart data={stats?.attendanceTrend}/></div></AppShell>}
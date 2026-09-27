"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { getTeachers, getClasses } from '@/lib/api';

export default function Teachers(){
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getTeachers().then(setTeachers).catch((e) => setErr(e.message)).finally(() => setLoading(false));
    getClasses().then(setClasses).catch(() => setClasses([]));
  }, []);
  const totalStudents = teachers.reduce((sum, t) => sum + (t.students || 0), 0);
  const card = [['Teachers', teachers.length], ['Classes', classes.length], ['Students Taught', totalStudents]];
  return <AppShell role="principal" title="Teachers"><div className="mb-5"><h2 className="text-2xl font-black">Teachers</h2><p className="text-sm text-slate-500">Manage teaching staff and assigned classes.</p></div>{err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p>}<div className="grid gap-4 md:grid-cols-3">{card.map(x=><div key={x[0]} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="text-sm text-slate-500">{x[0]}</div><div className="mt-1 text-3xl font-black">{loading ? '…' : x[1]}</div></div>)}</div><div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Teacher','Email','Classes','Students','Status'].map(x=><th className="px-4 py-3" key={x}>{x}</th>)}</tr></thead><tbody>{teachers.map(t=><tr key={t.id} className="border-t"><td className="px-4 py-3 font-bold">{t.name}</td><td className="px-4 py-3 text-slate-500">{t.email}</td><td className="px-4 py-3">{t.classes.length ? t.classes.join(', ') : '—'}</td><td className="px-4 py-3">{t.students}</td><td className="px-4 py-3 text-emerald-600">Active</td></tr>)}{teachers.length === 0 && !loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No teachers found.</td></tr>}</tbody></table></div></AppShell>}
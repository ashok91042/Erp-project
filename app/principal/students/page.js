"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { getStudents, getClasses } from '@/lib/api';

export default function Students(){
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getStudents().then(setStudents).catch((e) => setErr(e.message)).finally(() => setLoading(false));
    getClasses().then(setClasses).catch(() => setClasses([]));
  }, []);
  const withParent = students.filter((s) => s.parent_email).length;
  const card = [['Total Students', students.length], ['With Parent Link', withParent], ['Classes', classes.length]];
  return <AppShell role="principal" title="Students"><div className="mb-5"><h2 className="text-2xl font-black">Students</h2><p className="text-sm text-slate-500">{loading ? 'Loading…' : `${students.length} enrolled student${students.length === 1 ? '' : 's'} across ${classes.length} class${classes.length === 1 ? '' : 'es'}.`}</p></div>{err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p>}<div className="grid gap-4 md:grid-cols-3">{card.map(x=><div key={x[0]} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="text-sm text-slate-500">{x[0]}</div><div className="mt-2 text-3xl font-black">{x[1]}</div></div>)}</div><div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Roll No','Student','Class','Parent','Status'].map(x=><th className="px-4 py-3" key={x}>{x}</th>)}</tr></thead><tbody>{students.map(s=><tr key={s.id} className="border-t"><td className="px-4 py-3">{s.roll_no}</td><td className="px-4 py-3 font-bold">{s.full_name}</td><td className="px-4 py-3">{s.class_name || '—'}</td><td className="px-4 py-3">{s.parent_name || s.parent_email || '—'}</td><td className="px-4 py-3">{s.parent_email ? <span className="text-emerald-600">Linked</span> : <span className="text-slate-400">No parent</span>}</td></tr>)}{students.length === 0 && !loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No students found.</td></tr>}</tbody></table></div></AppShell>}

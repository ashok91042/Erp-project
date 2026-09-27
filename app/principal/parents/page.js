"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { getParents, getStudents } from '@/lib/api';

export default function Parents(){
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getParents().then(setParents).catch((e) => setErr(e.message)).finally(() => setLoading(false));
    getStudents().then(setStudents).catch(() => setStudents([]));
  }, []);
  return <AppShell role="principal" title="Parents"><div className="mb-5"><h2 className="text-2xl font-black">Parents</h2><p className="text-sm text-slate-500">Parent contacts and linked student accounts.</p></div>{err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p>}<div className="rounded-2xl border border-slate-200 bg-white p-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Parent','Children','Class','Email','Status'].map(x=><th className="px-4 py-3" key={x}>{x}</th>)}</tr></thead><tbody>{parents.map(p=><tr className="border-t" key={p.email}><td className="px-4 py-3"><b>{p.name || '—'}</b></td><td className="px-4 py-3">{p.child_names}</td><td className="px-4 py-3">{p.classes || '—'}</td><td className="px-4 py-3 text-slate-500">{p.email}</td><td className="px-4 py-3"><span className="text-emerald-600">Active</span></td></tr>)}{parents.length === 0 && !loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No parents linked to students yet.</td></tr>}</tbody></table></div><p className="mt-3 text-xs text-slate-400">{students.filter((s) => !s.parent_email).length} student(s) without a linked parent.</p></AppShell>}

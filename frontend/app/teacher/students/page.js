"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { getStudents } from '@/lib/api';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      try { setStudents(await getStudents()); } catch (e) { setErr(e.message); }
    })();
  }, []);
  return (
    <AppShell role="teacher" title="Students">
      <div className="mb-5"><h2 className="text-2xl font-black">Students</h2><p className="text-sm text-slate-500">Students assigned to your classes — live from the database.</p></div>
      {err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Roll No</th><th className="px-4 py-3">Student Name</th><th className="px-4 py-3">Class</th></tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{i + 1}</td>
                <td className="px-4 py-3 font-semibold">{s.roll_no}</td>
                <td className="px-4 py-3 font-semibold">{s.full_name}</td>
                <td className="px-4 py-3 text-slate-500">{s.class_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { getMarks } from '@/lib/api';

export default function Marks() {
  const [marks, setMarks] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try { setMarks(await getMarks()); } catch (e) { setErr(e.message); }
    })();
  }, []);

  return (
    <AppShell role="parent" title="Exam Results">
      <div className="mb-5">
        <h2 className="text-2xl font-black">Exam Results</h2>
        <p className="text-sm text-slate-500">All recorded marks for Class 10A.</p>
      </div>
      {err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Roll No</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Exam</th><th className="px-4 py-3">Score</th></tr>
          </thead>
          <tbody>
            {marks.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold">{m.roll_no}</td>
                <td className="px-4 py-3 font-semibold">{m.full_name}</td>
                <td className="px-4 py-3">{m.subject}</td>
                <td className="px-4 py-3">{m.exam_name}</td>
                <td className="px-4 py-3 font-black text-red-600">{m.score} / {m.max_score}</td>
              </tr>
            ))}
            {marks.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No marks recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

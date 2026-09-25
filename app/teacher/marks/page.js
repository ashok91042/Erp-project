"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { getStudents, getMarks, saveMarks } from '@/lib/api';

export default function Marks() {
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState([]);
  const [subject, setSubject] = useState('Mathematics');
  const [examName, setExamName] = useState('Unit Test 1');
  const [entries, setEntries] = useState({});
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [s, m] = await Promise.all([getStudents(), getMarks()]);
      setStudents(s); setMarks(m);
      const init = {};
      m.filter((x) => x.subject === subject && x.exam_name === examName).forEach((x) => { init[x.student_id] = x.score; });
      setEntries(init);
    } catch (e) { setStatus(`Load failed: ${e.message}`); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const init = {};
    marks.filter((x) => x.subject === subject && x.exam_name === examName).forEach((x) => { init[x.student_id] = x.score; });
    setEntries(init);
  }, [subject, examName, marks]);

  const save = async () => {
    setBusy(true); setStatus('');
    try {
      let n = 0;
      for (const s of students) {
        const score = entries[s.id];
        if (score === '' || score == null) continue;
        await saveMarks({ studentId: s.id, subject, examName, score: Number(score), maxScore: 100 });
        n++;
      }
      setStatus(`Saved ${n} mark entry(ies).`);
      load();
    } catch (e) { setStatus(`Save failed: ${e.message}`); } finally { setBusy(false); }
  };

  return (
    <AppShell role="teacher" title="Add / View Marks">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Add / View Marks</h2>
          <p className="text-sm text-slate-500">Enter examination marks for Class 10A.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
            {['Mathematics', 'Science', 'English', 'Social Studies', 'Computer Science'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <input value={examName} onChange={(e) => setExamName(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" placeholder="Exam name" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Roll No</th><th className="px-4 py-3">Student Name</th><th className="px-4 py-3">Marks / 100</th></tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{i + 1}</td>
                <td className="px-4 py-3 font-semibold">{s.roll_no}</td>
                <td className="px-4 py-3 font-semibold">{s.full_name}</td>
                <td className="px-4 py-3">
                  <input type="number" min="0" max="100" value={entries[s.id] ?? ''} onChange={(e) => setEntries((p) => ({ ...p, [s.id]: e.target.value }))} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5" placeholder="—" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {status && <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">{status}</p>}
      <div className="mt-4 flex justify-end">
        <button onClick={save} disabled={busy} className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save Marks'}</button>
      </div>
    </AppShell>
  );
}

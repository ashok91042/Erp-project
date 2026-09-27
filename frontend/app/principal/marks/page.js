"use client";
import AppShell from '@/components/AppShell';
import MarksTable from '@/components/MarksTable';
import { useEffect, useMemo, useState } from 'react';
import { getMarks, getClasses, getStudents } from '@/lib/api';

export default function Marks() {
  const [marks, setMarks] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [klass, setKlass] = useState('all');
  const [subject, setSubject] = useState('all');
  const [exam, setExam] = useState('all');
  const [err, setErr] = useState('');

  useEffect(() => {
    getMarks().then(setMarks).catch((e) => setErr(e.message));
    getClasses().then(setClasses).catch(() => setClasses([]));
    getStudents().then(setStudents).catch(() => setStudents([]));
  }, []);

  // marks reference student ids; map them to class names for the class filter
  const classOf = useMemo(() => {
    const map = new Map();
    students.forEach((s) => map.set(s.id, s.class_name || 'Unassigned'));
    return map;
  }, [students]);

  const subjects = useMemo(() => [...new Set(marks.map((m) => m.subject))].sort(), [marks]);
  const exams = useMemo(() => [...new Set(marks.map((m) => m.exam_name))].sort(), [marks]);

  const rows = useMemo(
    () =>
      marks.filter(
        (m) =>
          (klass === 'all' || classOf.get(m.student_id) === klass) &&
          (subject === 'all' || m.subject === subject) &&
          (exam === 'all' || m.exam_name === exam)
      ),
    [marks, klass, subject, exam, classOf]
  );

  const exportCsv = () => {
    const header = ['Roll No', 'Student', 'Class', 'Subject', 'Exam', 'Score', 'Max'];
    const body = rows.map((r) => [r.roll_no, r.full_name, classOf.get(r.student_id) || '', r.subject, r.exam_name, r.score, r.max_score]);
    const csv = [header, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exam-marks.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell role="principal" title="Exams & Marks">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-black">Exams & Marks</h2><p className="text-sm text-slate-500">{rows.length} result(s) — live from the database.</p></div>
        <div className="flex flex-wrap gap-2">
          <select value={klass} onChange={(e) => setKlass(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm font-bold">
            <option value="all">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm font-bold">
            <option value="all">All subjects</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={exam} onChange={(e) => setExam(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm font-bold">
            <option value="all">All exams</option>
            {exams.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={exportCsv} disabled={!rows.length} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50">Export CSV</button>
        </div>
      </div>
      {err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p>}
      <MarksTable rows={rows} empty="No marks match the selected filters." />
    </AppShell>
  );
}


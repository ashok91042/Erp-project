"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { getAttendance, saveAttendance, getClasses } from '@/lib/api';

function Toggle({ present, onClick }) {
  return (
    <button type="button" role="switch" aria-checked={present} onClick={onClick}
      className={`inline-flex w-[92px] items-center gap-1.5 rounded-full px-1.5 py-1.5 text-xs font-black transition-all ${present ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' : 'bg-red-100 text-red-700 ring-1 ring-red-300'}`}>
      <span className={`grid h-5 w-5 place-items-center rounded-full text-white ${present ? 'bg-emerald-500' : 'bg-red-500'}`}>
        {present ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      </span>
      {present ? 'Present' : 'Absent'}
    </button>
  );
}

export default function Attendance() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { getClasses().then(setClasses).catch(() => setClasses([])); }, []);

  const load = async (d) => {
    try {
      const data = await getAttendance(d);
      setRows(data.rows);
    } catch (e) { setStatus(`Load failed: ${e.message}`); }
  };
  useEffect(() => { load(date); }, [date]);

  const toggle = (id, key) => setRows((p) => p.map((r) => (r.id === id ? { ...r, [key]: !r[key] } : r)));
  const setRemark = (id, remarks) => setRows((p) => p.map((r) => (r.id === id ? { ...r, remarks } : r)));
  const markAll = (key, v) => setRows((p) => p.map((r) => ({ ...r, [key]: v })));

  const save = async () => {
    setBusy(true); setStatus('');
    try {
      const res = await saveAttendance({
        date,
        records: rows.map((r) => ({ studentId: r.id, fnPresent: r.fn_present, anPresent: r.an_present, remarks: r.remarks })),
      });
      setStatus(`Saved ${res.saved} records — ${res.absentees} absence alert(s) queued.`);
      load(date);
    } catch (e) { setStatus(`Save failed: ${e.message}`); } finally { setBusy(false); }
  };

  return (
    <AppShell role="teacher" title="Attendance">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Take Attendance</h2>
          <p className="text-sm text-slate-500">
            {classes.length ? classes.map((c) => c.name).join(', ') : 'Your classes'} • FN & AN sessions
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" />
          <button onClick={() => markAll('fn_present', true)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">All FN Present</button>
          <button onClick={() => markAll('an_present', true)} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">All AN Present</button>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Roll No</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">FN</th><th className="px-4 py-3">AN</th><th className="px-4 py-3">Remarks</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{i + 1}</td>
                <td className="px-4 py-3 font-semibold">{r.roll_no}</td>
                <td className="px-4 py-3 font-semibold">{r.full_name}</td>
                <td className="px-4 py-3"><Toggle present={r.fn_present} onClick={() => toggle(r.id, 'fn_present')} /></td>
                <td className="px-4 py-3"><Toggle present={r.an_present} onClick={() => toggle(r.id, 'an_present')} /></td>
                <td className="px-4 py-3"><input value={r.remarks || ''} onChange={(e) => setRemark(r.id, e.target.value)} className="w-40 rounded-lg border border-slate-200 px-2 py-1.5" placeholder="Remarks" /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No students found.</td></tr>}
          </tbody>
        </table>
      </div>
      {status && <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">{status}</p>}
      <div className="mt-4 flex justify-end">
        <button onClick={save} disabled={busy} className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save Attendance & Notify'}</button>
      </div>
    </AppShell>
  );
}

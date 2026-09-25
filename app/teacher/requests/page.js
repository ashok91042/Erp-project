"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { getRequests, createRequest } from '@/lib/api';

export default function Requests() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setRequests(await getRequests()); } catch (e) { setStatus(`Load failed: ${e.message}`); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setStatus('Please enter a request title.'); return; }
    setBusy(true); setStatus('');
    try {
      await createRequest({ title, description, requestType: 'general' });
      setStatus('Request submitted — pending Principal approval.');
      setTitle(''); setDescription('');
      load();
    } catch (err) { setStatus(`Submit failed: ${err.message}`); } finally { setBusy(false); }
  };

  return (
    <AppShell role="teacher" title="Change Requests">
      <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-black">Submit Request to Principal</h2>
          <p className="mt-1 text-sm text-slate-500">Attendance or marks corrections, leave, resources…</p>
          <div className="mt-5 grid gap-4">
            <label className="text-sm font-bold">Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full rounded-xl border p-3" placeholder="e.g. Correction: AN attendance for 20 Sep" />
            </label>
            <label className="text-sm font-bold">Description
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border p-3" placeholder="Reason / details…" />
            </label>
            <button disabled={busy} className="rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Submitting…' : 'Submit Request'}</button>
          </div>
          {status && <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">{status}</p>}
        </form>
        <div>
          <h3 className="mb-3 text-lg font-black">My Requests</h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Principal Note</th></tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-3"><div className="font-semibold">{r.title}</div><div className="text-xs text-slate-500">{r.description}</div></td>
                    <td className="px-4 py-3 text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-1 text-xs font-black ${r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.decision_note || '—'}</td>
                  </tr>
                ))}
                {requests.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No requests yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { getRequests, decideRequest } from '@/lib/api';

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState('');

  const load = async () => {
    try { setRequests(await getRequests(filter || undefined)); } catch (e) { setStatus(`Load failed: ${e.message}`); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const decide = async (id, action) => {
    setBusyId(id); setStatus('');
    try {
      await decideRequest(id, { action, note: action === 'approved' ? 'Approved by Principal' : 'Rejected by Principal' });
      setStatus(`Request ${action}.`);
      load();
    } catch (e) { setStatus(`Decision failed: ${e.message}`); } finally { setBusyId(null); }
  };

  const pending = requests.filter((r) => r.status === 'pending').length;

  return (
    <AppShell role="principal" title="Approval Requests">
      <div className="mb-5">
        <h2 className="text-2xl font-black">Approval Requests</h2>
        <p className="text-sm text-slate-500">Review teacher requests — decisions notify the teacher by email.</p>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {[['', `All (${requests.length})`], ['pending', `Pending (${pending})`], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === v ? 'bg-red-600 text-white' : 'border bg-white'}`}>{label}</button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Teacher</th><th className="px-4 py-3">Title</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold">{r.teacher_name}</td>
                <td className="px-4 py-3"><div className="font-semibold">{r.title}</div><div className="text-xs text-slate-500">{r.description}</div></td>
                <td className="px-4 py-3 text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-md px-2 py-1 text-xs font-black ${r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3">
                  {r.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button disabled={busyId === r.id} onClick={() => decide(r.id, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Approve</button>
                      <button disabled={busyId === r.id} onClick={() => decide(r.id, 'rejected')} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Reject</button>
                    </div>
                  ) : <span className="text-xs text-slate-400">{r.decision_note || 'decided'}</span>}
                </td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No requests.</td></tr>}
          </tbody>
        </table>
      </div>
      {status && <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">{status}</p>}
    </AppShell>
  );
}

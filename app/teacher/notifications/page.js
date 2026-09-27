"use client";
import AppShell from '@/components/AppShell';
import Notification from '@/components/Notification';
import { useEffect, useState } from 'react';
import { getStats, getRequests } from '@/lib/api';

const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getRequests()])
      .then(([stats, requests]) => {
        const list = [
          ...(stats.absences || []).map((a) => ({
            type: 'alert',
            title: `Absence — ${a.student}`,
            text: `${a.student} was marked absent (${a.session}) in your class.`,
            time: fmt(a.date),
            key: `abs-${a.student}-${a.date}-${a.session}`,
          })),
          ...(requests || []).map((r) => ({
            type: r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'alert' : 'info',
            title: `Request ${r.status}: ${r.title}`,
            text: r.decision_note || (r.description ?? 'Awaiting Principal decision.'),
            time: fmt(r.created_at),
            key: `req-${r.id}`,
          })),
        ];
        setItems(list);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell role="teacher" title="Notifications">
      {err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p>}
      <div className="max-w-3xl space-y-3">
        {items.map((n) => <Notification key={n.key} type={n.type} title={n.title} text={n.text} time={n.time} />)}
        {!loading && items.length === 0 && (
          <p className="rounded-2xl bg-white p-8 text-center text-slate-400 ring-1 ring-slate-200">No notifications yet.</p>
        )}
        {loading && <p className="rounded-2xl bg-white p-8 text-center text-slate-400 ring-1 ring-slate-200">Loading…</p>}
      </div>
    </AppShell>
  );
}


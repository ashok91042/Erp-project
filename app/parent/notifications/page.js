"use client";
import AppShell from '@/components/AppShell';
import Notification from '@/components/Notification';
import { useEffect, useState } from 'react';
import { getStats, getMarks } from '@/lib/api';

const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getMarks()])
      .then(([stats, marks]) => {
        const list = [
          ...(stats.absences || []).map((a) => ({
            type: 'alert',
            title: `Absence Alert — ${a.student}`,
            text: `Your child was marked absent (${a.session}) on ${fmt(a.date)}.`,
            time: fmt(a.date),
            key: `abs-${a.student}-${a.date}-${a.session}`,
          })),
          ...(marks || []).map((m) => ({
            type: 'info',
            title: `${m.subject} result published`,
            text: `${m.full_name} scored ${m.score}/${m.max_score} in ${m.exam_name}.`,
            time: fmt(m.created_at),
            key: `mark-${m.id}`,
          })),
        ];
        setItems(list);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell role="parent" title="Notifications">
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


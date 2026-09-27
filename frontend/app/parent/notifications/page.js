"use client";
import AppShell from '@/components/AppShell';
import Notification from '@/components/Notification';
import { useEffect, useState } from 'react';
import { getStats, getMarks } from '@/lib/api';
import { buildFeed } from '@/lib/notifications';

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getMarks()])
      .then(([stats, marks]) => setItems(buildFeed('parent', { stats, marks })))
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


"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { getMe } from '@/lib/api';

const KEY = 'erp.settings.parent';
const DEFAULTS = { absenceAlerts: true, weeklySummary: false, sms: false };

export default function Settings() {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState(DEFAULTS);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    try { setForm({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || 'null') }); } catch {}
    getMe().then(setMe).catch((e) => setErr(e.message));
  }, []);

  const toggle = (k) => () => setForm((f) => ({ ...f, [k]: !f[k] }));
  const save = () => { localStorage.setItem(KEY, JSON.stringify(form)); setMsg('Preferences saved on this device.'); };

  return (
    <AppShell role="parent" title="Settings">
      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-2xl font-black">Parent Settings</h2>
        {err && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p>}
        {msg && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{msg}</p>}
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-bold">Full name<input readOnly value={me?.full_name || ''} className="mt-2 w-full rounded-xl border bg-slate-50 p-3 text-slate-600"/></label>
          <label className="block text-sm font-bold">Email<input readOnly value={me?.email || ''} className="mt-2 w-full rounded-xl border bg-slate-50 p-3 text-slate-600"/></label>
          {[['absenceAlerts', 'Email absence alerts'], ['weeklySummary', 'Weekly progress summary'], ['sms', 'SMS alerts']].map(([k, label]) => (
            <label key={k} className="flex items-center justify-between rounded-xl bg-slate-50 p-4 text-sm font-bold">
              {label}<input type="checkbox" checked={form[k]} onChange={toggle(k)} className="h-5 w-5 accent-red-600"/>
            </label>
          ))}
          <button onClick={save} className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white">Save Changes</button>
        </div>
      </div>
    </AppShell>
  );
}


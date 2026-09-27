"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { getMe, getStats } from '@/lib/api';

const DEFAULTS = { institution: 'AcademicERP', academicYear: '2026–27', notifyEmail: '', timezone: 'Asia/Kolkata', weekStart: 'Monday' };
const KEY = 'erp.settings.principal';

export default function Settings() {
  const [form, setForm] = useState(DEFAULTS);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved) setForm({ ...DEFAULTS, ...saved }); } catch {}
    getMe().then((u) => setForm((f) => ({ ...f, notifyEmail: f.notifyEmail || u.email || '' }))).catch((e) => setErr(e.message));
    getStats().catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(form));
    setMsg('Settings saved on this device.');
  };

  return (
    <AppShell role="principal" title="Settings">
      <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-2xl font-black">Institution Settings</h2>
        <p className="mt-1 text-sm text-slate-500">Configure your AcademicERP workspace. Values are stored locally in this demo.</p>
        {err && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">API error: {err}</p>}
        {msg && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{msg}</p>}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold">Institution name<input value={form.institution} onChange={set('institution')} className="mt-2 w-full rounded-xl border p-3"/></label>
          <label className="text-sm font-bold">Academic year<input value={form.academicYear} onChange={set('academicYear')} className="mt-2 w-full rounded-xl border p-3"/></label>
          <label className="text-sm font-bold">Notification email<input value={form.notifyEmail} onChange={set('notifyEmail')} className="mt-2 w-full rounded-xl border p-3"/></label>
          <label className="text-sm font-bold">Timezone
            <select value={form.timezone} onChange={set('timezone')} className="mt-2 w-full rounded-xl border p-3">
              {['Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">Week starts on
            <select value={form.weekStart} onChange={set('weekStart')} className="mt-2 w-full rounded-xl border p-3">
              {['Monday', 'Sunday'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <button onClick={save} className="mt-6 rounded-xl bg-red-600 px-5 py-3 font-bold text-white">Save Settings</button>
      </div>
    </AppShell>
  );
}


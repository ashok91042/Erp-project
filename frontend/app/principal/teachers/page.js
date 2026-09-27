"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Search } from 'lucide-react';
import { getTeachers, getClasses, createTeacher, updateTeacher, deleteTeacher } from '@/lib/api';

const EMPTY_FORM = { fullName: '', email: '', password: '', classId: '' };

export default function Teachers(){
  const [q, setQ] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [saved, setSaved] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      setTeachers(await getTeachers());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    getClasses().then(setClasses).catch(() => setClasses([]));
  }, []);

  const openModal = () => { setForm(EMPTY_FORM); setEditing(null); setFormErr(''); setSaved(''); setShowModal(true); };

  const openEdit = (t) => {
    setForm({ fullName: t.name, email: t.email, password: '', classId: (t.classIds || [])[0] || '' });
    setEditing(t.id);
    setFormErr('');
    setSaved('');
    setShowModal(true);
  };

  const remove = async (t) => {
    if (!window.confirm(`Remove ${t.name} (${t.email})? Their class will be unassigned.`)) return;
    setSaved(''); setErr('');
    try {
      await deleteTeacher(t.id);
      setSaved(`Teacher ${t.name} removed.`);
      await load();
    } catch (e) { setErr(e.message); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormErr('');
    if (!form.fullName.trim()) { setFormErr('Full name is required.'); return; }
    if (!editing) {
      if (!form.email.trim()) { setFormErr('Email is required.'); return; }
      if (form.password.length < 8) { setFormErr('Password must be at least 8 characters.'); return; }
    }
    setSaving(true);
    try {
      if (editing) {
        // Email is the login identity, so it stays immutable (like a roll number).
        const updated = await updateTeacher(editing, { fullName: form.fullName.trim(), classId: form.classId || null });
        setShowModal(false);
        setSaved(`Teacher ${updated.full_name} updated.`);
      } else {
        const created = await createTeacher({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          classId: form.classId || undefined,
        });
        setShowModal(false);
        setSaved(`Teacher ${created.full_name} added.`);
      }
      await load();
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const totalStudents = teachers.reduce((sum, t) => sum + (t.students || 0), 0);
  const card = [['Teachers', teachers.length], ['Classes', classes.length], ['Students Taught', totalStudents]];
  const list = teachers.filter((t) =>
    [t.name, t.email, (t.classes || []).join(' ')].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase())
  );

  return (
    <AppShell role="principal" title="Teachers">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">Teachers</h2>
            <p className="text-sm text-slate-500">Manage teaching staff and assigned classes.</p>
          </div>
          <button onClick={openModal} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700"><Plus size={17}/> Add Teacher</button>
        </div>
        {saved && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{saved}</p>}
        {err && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600">API error: {err}</p>}
        <div className="mt-4 flex min-w-[240px] items-center gap-2 rounded-xl border border-slate-200 px-3">
          <Search size={17} className="text-slate-400"/>
          <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full py-3 outline-none" placeholder="Search teachers…"/>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">{card.map(x=><div key={x[0]} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="text-sm text-slate-500">{x[0]}</div><div className="mt-1 text-3xl font-black">{loading ? '…' : x[1]}</div></div>)}</div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{['Teacher','Email','Classes','Students','Status','Actions'].map(x=><th className="px-4 py-3" key={x}>{x}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading teachers…</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No teachers found.</td></tr>
            ) : list.map(t=>(
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-bold">{t.name}</td>
                <td className="px-4 py-3 text-slate-500">{t.email}</td>
                <td className="px-4 py-3">{t.classes.length ? t.classes.join(', ') : '—'}</td>
                <td className="px-4 py-3">{t.students}</td>
                <td className="px-4 py-3 text-emerald-600">Active</td>
                <td className="px-4 py-3"><div className="flex gap-2">
                  <button onClick={() => openEdit(t)} title="Edit teacher" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil size={15}/></button>
                  <button onClick={() => remove(t)} title="Remove teacher" className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={15}/></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-black">{editing ? 'Edit Teacher' : 'Add Teacher'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18}/></button>
            </div>
            {formErr && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600">{formErr}</p>}
            <label className="mb-2 block text-sm font-bold">Full name</label>
            <input value={form.fullName} onChange={set('fullName')} className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-red-200 focus:ring-4" placeholder="e.g. Mrs. Lakshmi Menon"/>
            <label className="mb-2 block text-sm font-bold">Email address</label>
            <input value={form.email} onChange={set('email')} type="email" readOnly={!!editing} className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-red-200 focus:ring-4 read-only:bg-slate-50 read-only:text-slate-500" placeholder="teacher@school.edu"/>
            {!editing && (
              <>
                <label className="mb-2 block text-sm font-bold">Password <span className="font-normal text-slate-400">(min 8 characters)</span></label>
                <input value={form.password} onChange={set('password')} type="password" autoComplete="new-password" className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-red-200 focus:ring-4" placeholder="Create a login password"/>
              </>
            )}
            <label className="mb-2 block text-sm font-bold">Class <span className="font-normal text-slate-400">(optional)</span></label>
            <select value={form.classId} onChange={set('classId')} className="mb-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-red-200 focus:ring-4">
              <option value="">No class assigned</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="mb-4 text-xs text-slate-400">Assigning a class moves it to this teacher.{editing ? ' Email cannot be changed after the account is created.' : ''}</p>
            <div className="mt-2 flex gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button disabled={saving} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Teacher'}</button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

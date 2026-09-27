"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Search } from 'lucide-react';
import { getParents, getStudents, createParent, updateParent, deleteParent } from '@/lib/api';

const EMPTY_FORM = { fullName: '', email: '', password: '', studentIds: [] };

export default function Parents(){
  const [q, setQ] = useState('');
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
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
      setParents(await getParents());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    getStudents().then(setStudents).catch(() => setStudents([]));
  }, []);

  const openModal = () => { setForm(EMPTY_FORM); setEditing(null); setFormErr(''); setSaved(''); setShowModal(true); };

  const openEdit = (p) => {
    setForm({ fullName: p.name || '', email: p.email, password: '', studentIds: [...(p.student_ids || [])] });
    setEditing(p.email);
    setFormErr('');
    setSaved('');
    setShowModal(true);
  };

  const remove = async (p) => {
    if (!window.confirm(`Remove parent ${p.name || p.email}? Their ${p.children} child(ren) will be unlinked.`)) return;
    setSaved(''); setErr('');
    try {
      await deleteParent(p.email);
      setSaved(`Parent ${p.name || p.email} removed.`);
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
        // Email links the account to its children, so it stays immutable.
        const updated = await updateParent(editing, { fullName: form.fullName.trim(), studentIds: form.studentIds });
        setShowModal(false);
        setSaved(`Parent ${updated.full_name} updated.`);
      } else {
        const created = await createParent({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          studentIds: form.studentIds,
        });
        setShowModal(false);
        setSaved(`Parent ${created.full_name} added.`);
      }
      await load();
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (ev) => setForm((f) => ({ ...f, [k]: ev.target.value }));
  const toggleStudent = (id) => setForm((f) => ({
    ...f,
    studentIds: f.studentIds.includes(id) ? f.studentIds.filter((x) => x !== id) : [...f.studentIds, id],
  }));
  const unlinked = students.filter((s) => !s.parent_email).length;
  const list = parents.filter((p) =>
    [p.name, p.email, p.child_names, p.classes].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase())
  );

  // Contact-only rows (no login account yet) get promoted via the add form.
  const startFromContact = (p) => {
    setForm({ fullName: '', email: p.email, password: '', studentIds: [...(p.student_ids || [])] });
    setEditing(null);
    setFormErr('');
    setSaved('');
    setShowModal(true);
  };

  return (
    <AppShell role="principal" title="Parents">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">Parents</h2>
            <p className="text-sm text-slate-500">Parent contacts and linked student accounts.</p>
          </div>
          <button onClick={openModal} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700"><Plus size={17}/> Add Parent</button>
        </div>
        {saved && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{saved}</p>}
        {err && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600">API error: {err}</p>}
        <div className="mt-4 flex min-w-[240px] items-center gap-2 rounded-xl border border-slate-200 px-3">
          <Search size={17} className="text-slate-400"/>
          <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full py-3 outline-none" placeholder="Search parents…"/>
        </div>
        <p className="mt-3 text-xs text-slate-400">{unlinked} student(s) without a linked parent.</p>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{['Parent','Children','Class','Email','Status','Actions'].map(x=><th className="px-4 py-3" key={x}>{x}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading parents…</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No parents linked to students yet.</td></tr>
            ) : list.map(p=>(
              <tr key={p.email} className="border-t border-slate-100">
                <td className="px-4 py-3"><b>{p.name || '—'}</b></td>
                <td className="px-4 py-3">{p.child_names}</td>
                <td className="px-4 py-3">{p.classes || '—'}</td>
                <td className="px-4 py-3 text-slate-500">{p.email}</td>
                <td className="px-4 py-3">
                  {p.id
                    ? <span className="text-emerald-600">Active</span>
                    : <span className="text-amber-600">Contact only</span>}
                </td>
                <td className="px-4 py-3"><div className="flex gap-2">
                  {p.id ? (
                    <>
                      <button onClick={() => openEdit(p)} title="Edit parent" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil size={15}/></button>
                      <button onClick={() => remove(p)} title="Remove parent" className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={15}/></button>
                    </>
                  ) : (
                    <button onClick={() => startFromContact(p)} title="Create a login account for this contact" className="rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">Create account</button>
                  )}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <form onSubmit={submit} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-black">{editing ? 'Edit Parent' : 'Add Parent'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18}/></button>
            </div>
            {formErr && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600">{formErr}</p>}
            <label className="mb-2 block text-sm font-bold">Full name</label>
            <input value={form.fullName} onChange={set('fullName')} className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-red-200 focus:ring-4" placeholder="e.g. Meera Krishnan"/>
            <label className="mb-2 block text-sm font-bold">Email address</label>
            <input value={form.email} onChange={set('email')} type="email" readOnly={!!editing} className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-red-200 focus:ring-4 read-only:bg-slate-50 read-only:text-slate-500" placeholder="parent@example.com"/>
            {!editing && (
              <>
                <label className="mb-2 block text-sm font-bold">Password <span className="font-normal text-slate-400">(min 8 characters)</span></label>
                <input value={form.password} onChange={set('password')} type="password" autoComplete="new-password" className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-red-200 focus:ring-4" placeholder="Create a login password"/>
              </>
            )}
            <label className="mb-1 block text-sm font-bold">Children <span className="font-normal text-slate-400">({form.studentIds.length} selected)</span></label>
            <p className="mb-2 text-xs text-slate-400">Selecting a child moves them to this parent.</p>
            <div className="mb-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200">
              {students.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">No students available.</p>
              ) : students.map(s => {
                const on = form.studentIds.includes(s.id);
                const elsewhere = s.parent_email && !on;
                return (
                  <label key={s.id} className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-0 ${on ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleStudent(s.id)} className="h-4 w-4 accent-red-600"/>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{s.full_name}</span>
                      <span className="block text-xs text-slate-400">{s.roll_no}{s.class_name ? ` · ${s.class_name}` : ''}</span>
                    </span>
                    {elsewhere && <span className="shrink-0 text-[10px] font-bold text-amber-600" title={`Currently with ${s.parent_email}`}>REASSIGN</span>}
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button disabled={saving} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Parent'}</button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

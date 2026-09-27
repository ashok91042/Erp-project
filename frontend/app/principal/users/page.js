"use client";
import AppShell from '@/components/AppShell';
import { useEffect, useState } from 'react';
import { Search, Plus, Pencil, Trash2, X } from 'lucide-react';
import { getStudents, getClasses, createStudent, updateStudent, deleteStudent } from '@/lib/api';

const EMPTY_FORM = { fullName: '', rollNo: '', classId: '', parentEmail: '' };

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [linkFilter, setLinkFilter] = useState('all');
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listErr, setListErr] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [saved, setSaved] = useState('');

  const load = async () => {
    setLoading(true);
    setListErr('');
    try {
      setStudents(await getStudents());
    } catch (e) {
      setListErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    getClasses().then(setClasses).catch(() => setClasses([]));
  }, []);

  const openModal = () => { setForm(EMPTY_FORM); setEditing(null); setFormErr(''); setShowModal(true); };

  const openEdit = (s) => {
    setForm({ fullName: s.full_name, rollNo: s.roll_no, classId: '', parentEmail: s.parent_email || '' });
    setEditing(s.id);
    setFormErr('');
    setShowModal(true);
  };

  const remove = async (s) => {
    if (!window.confirm(`Delete ${s.full_name} (${s.roll_no})? Their marks and attendance records are removed too.`)) return;
    setSaved(''); setListErr('');
    try {
      await deleteStudent(s.id);
      setSaved(`Student ${s.full_name} deleted.`);
      await load();
    } catch (e) { setListErr(e.message); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormErr('');
    if (!form.fullName.trim() || !form.rollNo.trim()) {
      setFormErr('Full name and roll number are required.');
      return;
    }
    if (!editing && !form.classId) {
      setFormErr('Please select a class.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        // Roll number is immutable; class is only sent when explicitly chosen
        const patch = { fullName: form.fullName.trim() };
        if (form.classId) patch.classId = form.classId;
        patch.parentEmail = form.parentEmail.trim() ? form.parentEmail.trim() : null;
        const updated = await updateStudent(editing, patch);
        setShowModal(false);
        setSaved(`Student ${updated.full_name} updated.`);
      } else {
        const created = await createStudent({
          fullName: form.fullName.trim(),
          rollNo: form.rollNo.trim(),
          classId: form.classId,
          parentEmail: form.parentEmail.trim() || undefined,
        });
        setShowModal(false);
        setSaved(`Student ${created.full_name} (${created.roll_no}) added.`);
      }
      await load();
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const list = students.filter((s) =>
    (classFilter === 'all' || s.class_name === classFilter) &&
    (linkFilter === 'all' || (linkFilter === 'linked' ? !!s.parent_email : !s.parent_email)) &&
    [s.full_name, s.roll_no, s.class_name, s.parent_name, s.parent_email]
      .filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase())
  );

  return (
    <AppShell role="principal" title="Manage Users">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Manage Users</h2>
            <p className="text-sm text-slate-500">Create and manage students, teachers and parents.</p>
          </div>
          <button onClick={openModal} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700"><Plus size={17}/> Add Student</button>
        </div>
        {saved && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{saved}</p>}
        {listErr && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600">Failed to load students: {listErr}. Is the API running?</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3">
            <Search size={17} className="text-slate-400"/>
            <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full py-3 outline-none" placeholder="Search students…"/>
          </div>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold">
            <option value="all">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select value={linkFilter} onChange={(e) => setLinkFilter(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold">
            <option value="all">Linked & unlinked</option>
            <option value="linked">Parent linked</option>
            <option value="unlinked">No parent</option>
          </select>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['#','Name','Class','Roll No','Parent','Status','Actions'].map((x) => <th key={x} className="px-3 py-3">{x}</th>)}</tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">Loading students…</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No students found.</td></tr>
              ) : list.map((s, i) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">{i + 1}</td>
                  <td className="px-3 py-3 font-medium">{s.full_name}</td>
                  <td className="px-3 py-3 font-medium">{s.class_name || '—'}</td>
                  <td className="px-3 py-3 font-medium">{s.roll_no}</td>
                  <td className="px-3 py-3 font-medium">{s.parent_name || s.parent_email || '—'}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Active</span></td>
                  <td className="px-3 py-3"><div className="flex gap-2"><button onClick={() => openEdit(s)} title="Edit student" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil size={15}/></button><button onClick={() => remove(s)} title="Delete student" className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={15}/></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-black">{editing ? 'Edit Student' : 'Add Student'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18}/></button>
            </div>
            {formErr && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600">{formErr}</p>}
            <label className="mb-2 block text-sm font-bold">Full name</label>
            <input value={form.fullName} onChange={set('fullName')} className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-red-200 focus:ring-4" placeholder="e.g. Aarav Kumar"/>
            <label className="mb-2 block text-sm font-bold">Roll number</label>
            <input value={form.rollNo} onChange={set('rollNo')} readOnly={!!editing} className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-red-200 focus:ring-4 disabled:bg-slate-50 disabled:text-slate-500" placeholder="e.g. 10A-09"/>
            <label className="mb-2 block text-sm font-bold">Class {editing && <span className="font-normal text-slate-400">(leave as-is to keep current)</span>}</label>
            <select value={form.classId} onChange={set('classId')} className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-red-200 focus:ring-4">
              <option value="">Select a class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="mb-2 block text-sm font-bold">Parent email <span className="font-normal text-slate-400">(optional)</span></label>
            <input value={form.parentEmail} onChange={set('parentEmail')} type="email" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-red-200 focus:ring-4" placeholder="parent@example.com"/>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button disabled={saving} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Student'}</button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

export default function DashboardCard({ title, value, note, icon: Icon, tone = 'red' }) {
  const tones = { red:'bg-red-50 text-red-600', blue:'bg-blue-50 text-blue-600', green:'bg-emerald-50 text-emerald-600', amber:'bg-amber-50 text-amber-600' };
  return <div className="card-shadow rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold text-slate-500">{title}</div><div className="mt-1 text-2xl font-black text-slate-900">{value}</div></div><div className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone] || tones.red}`}><Icon size={20}/></div></div>{note && <div className="mt-3 text-xs font-semibold text-emerald-600">↗ {note}</div>}</div>;
}

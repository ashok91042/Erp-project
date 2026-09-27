// Charts accept optional live data; hardcoded arrays remain as fallbacks so
// panels still render before/without an API response.
const DEFAULT_ATTENDANCE = [52, 65, 78, 62, 70, 59];
const DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_MONTHLY = [95, 82, 72, 89, 66, 58];
const DEFAULT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const PALETTE = ["#16a34a", "#2563eb", "#f59e0b", "#7c3aed", "#94a3b8"];

const toValues = (data, fallback) =>
  data && data.length ? data.map((d) => (typeof d === "object" ? d.pct ?? 0 : d)) : fallback;
const toLabels = (labels, data, fallback) =>
  labels && labels.length
    ? labels
    : data && data.length
      ? data.map((d) => (typeof d === "object" ? (d.date || "").slice(5) : ""))
      : fallback;

export function AttendanceChart({ data, labels }) {
  const values = toValues(data, DEFAULT_ATTENDANCE);
  const lbl = toLabels(labels, data, DEFAULT_DAYS);
  return (
    <div className="card-shadow rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div><h3 className="font-black">Attendance Overview</h3><p className="text-xs text-slate-500">Present vs absent</p></div>
        <div className="text-xs"><span className="mr-3 text-emerald-600">● Present</span><span className="text-red-500">● Absent</span></div>
      </div>
      <div className="mt-5 flex h-48 items-end gap-3 border-b border-l border-slate-200 px-4 pb-0 pt-5">
        {values.map((h, i) => (
          <div key={i} className="flex h-full flex-1 items-end gap-1">
            <div className="w-1/2 rounded-t bg-emerald-500" style={{ height: `${h}%` }} />
            <div className="w-1/2 rounded-t bg-red-400" style={{ height: `${Math.max(100 - h, 8)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between px-2 text-[10px] text-slate-400">
        {lbl.map((x, i) => <span key={`${x}-${i}`}>{x}</span>)}
      </div>
    </div>
  );
}

export function StrengthChart({ items }) {
  const list = items && items.length
    ? items.map((s) => [s.name, s.count])
    : [["Class 10", 320], ["Class 9", 298], ["Class 8", 254], ["Class 7", 220], ["Others", 156]];
  const total = list.reduce((sum, [, n]) => sum + Number(n || 0), 0) || 1;
  let acc = 0;
  const stops = list
    .map(([, n], i) => {
      const from = (acc / total) * 100;
      acc += Number(n || 0);
      const to = (acc / total) * 100;
      return `${PALETTE[i % PALETTE.length]} ${from.toFixed(1)}% ${to.toFixed(1)}%`;
    })
    .join(", ");
  return (
    <div className="card-shadow rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-black">Class-wise Strength</h3>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${stops})` }}>
          <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center">
            <div><div className="text-xl font-black">{total.toLocaleString("en-IN")}</div><div className="text-[10px] text-slate-500">Students</div></div>
          </div>
        </div>
        <div className="space-y-2 text-xs">
          {list.map(([label, n], i) => (
            <div key={`${label}-${i}`} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="w-20 truncate text-slate-500">{label}</span><b>{n}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MonthlyChart({ data, labels }) {
  const values = toValues(data, DEFAULT_MONTHLY);
  const lbl = toLabels(labels, data, DEFAULT_MONTHS);
  return (
    <div className="card-shadow rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div><h3 className="font-black">Attendance Trend</h3><p className="text-xs text-slate-500">Present / absent</p></div>
        <div className="text-xs text-slate-500">▮ Present &nbsp; <span className="text-red-500">▮ Absent</span></div>
      </div>
      <div className="mt-5 flex h-44 items-end gap-4 border-b border-slate-200 px-2">
        {values.map((h, i) => (
          <div key={i} className="flex h-full flex-1 items-end gap-1">
            <div className="w-1/2 rounded-t bg-emerald-500" style={{ height: `${h}%` }} />
            <div className="w-1/2 rounded-t bg-red-400" style={{ height: `${Math.max(100 - h, 8)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        {lbl.map((x, i) => <span key={`${x}-${i}`}>{x}</span>)}
      </div>
    </div>
  );
}

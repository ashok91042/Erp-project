"use client";
import { Bell, CalendarDays, Menu, Search, CheckCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getMe, getStats, getRequests, getMarks } from "@/lib/api";
import { buildFeed, loadRead, saveRead, MORE_URL } from "@/lib/notifications";

export default function Header({ title, onMenu, role }) {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [read, setRead] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const wrapRef = useRef(null);
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  useEffect(() => { getMe().then(setUser).catch(() => setUser(null)); }, []);

  // Counters refresh whenever the panel is opened, so the badge is never stale.
  const loadFeed = useCallback(() => {
    if (!role) return;
    setLoading(true);
    setErr("");
    const jobs = [getStats()];
    if (role === "parent") jobs.push(Promise.resolve([]), getMarks());
    else jobs.push(getRequests());
    Promise.all(jobs)
      .then(([stats, requests, marks]) => setItems(buildFeed(role, { stats, requests, marks })))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [role]);

  useEffect(() => { setRead(loadRead(user?.id)); }, [user?.id]);
  useEffect(() => { loadFeed(); }, [loadFeed]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = items.filter((n) => !read.has(n.key)).length;

  const markAll = () => {
    const next = new Set(read);
    items.forEach((n) => next.add(n.key));
    setRead(next);
    saveRead(user?.id, next);
  };

  return <header className="sticky top-0 z-30 flex h-[72px] items-center gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
    <button onClick={onMenu} className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"><Menu size={21}/></button>
    <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-black text-slate-900">{title}</h1><p className="hidden text-xs text-slate-500 sm:block">Smarter management • Stronger education</p></div>
    <div className="hidden items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 md:flex"><Search size={17} className="text-slate-400"/><input className="w-36 bg-transparent text-sm outline-none" placeholder="Search…"/></div>
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        className={`relative rounded-xl border p-2.5 transition ${open ? "border-red-300 bg-red-50" : "border-slate-200 hover:bg-slate-50"}`}
      >
        <Bell size={18}/>
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div>
              <div className="text-sm font-black">Notifications</div>
              <div className="text-[11px] text-slate-400">{unread ? `${unread} unread` : "All caught up"}</div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={markAll} disabled={!items.length} title="Mark all as read" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><CheckCheck size={16}/></button>
              <button onClick={loadFeed} title="Refresh" className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100">Refresh</button>
              <button onClick={() => setOpen(false)} title="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={16}/></button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>}
            {!loading && err && <p className="px-4 py-6 text-center text-sm font-semibold text-red-600">{err}</p>}
            {!loading && !err && items.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">You&rsquo;re all caught up.</p>}
            {!loading && !err && items.map((n) => {
              const isRead = read.has(n.key);
              return (
                <a
                  key={n.key}
                  href={MORE_URL[role] || "/"}
                  onClick={() => {
                    const next = new Set(read);
                    next.add(n.key);
                    setRead(next);
                    saveRead(user?.id, next);
                    setOpen(false);
                  }}
                  className={`flex gap-3 border-b border-slate-50 px-4 py-3 transition hover:bg-slate-50 ${isRead ? "opacity-60" : "bg-white"}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isRead ? "bg-transparent" : "bg-red-600"}`}/>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-snug">{n.title}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{n.text}</span>
                    {n.time && <span className="mt-1 block text-[11px] text-slate-400">{n.time}</span>}
                  </span>
                </a>
              );
            })}
          </div>

          <a href={MORE_URL[role] || "/"} className="block border-t border-slate-100 px-4 py-3 text-center text-xs font-black text-red-600 hover:bg-red-50">
            View all
          </a>
        </div>
      )}
    </div>

    <div className="hidden items-center gap-3 border-l border-slate-200 pl-4 sm:flex"><div className="grid h-9 w-9 place-items-center rounded-full bg-red-100 text-sm font-black text-red-700">{(user?.full_name || "A")[0]}</div><div><div className="text-sm font-bold">{user?.full_name || "AcademicERP User"}</div><div className="text-[11px] capitalize text-slate-400">{user?.role || "user"}</div></div></div>
    <div className="hidden items-center gap-1 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-500 lg:flex"><CalendarDays size={14}/> {today}</div>
  </header>;
}
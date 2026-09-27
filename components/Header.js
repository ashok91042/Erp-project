"use client";
import { Bell, CalendarDays, Menu, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { getMe } from "@/lib/api";

export default function Header({ title, onMenu }) {
  const [user, setUser] = useState(null);
  useEffect(() => { getMe().then(setUser).catch(() => setUser(null)); }, []);
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return <header className="sticky top-0 z-30 flex h-[72px] items-center gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
    <button onClick={onMenu} className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"><Menu size={21}/></button>
    <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-black text-slate-900">{title}</h1><p className="hidden text-xs text-slate-500 sm:block">Smarter management • Stronger education</p></div>
    <div className="hidden items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 md:flex"><Search size={17} className="text-slate-400"/><input className="w-36 bg-transparent text-sm outline-none" placeholder="Search…"/></div>
    <button className="relative rounded-xl border border-slate-200 p-2.5"><Bell size={18}/><span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-600"/></button>
    <div className="hidden items-center gap-3 border-l border-slate-200 pl-4 sm:flex"><div className="grid h-9 w-9 place-items-center rounded-full bg-red-100 text-sm font-black text-red-700">{(user?.full_name || "A")[0]}</div><div><div className="text-sm font-bold">{user?.full_name || "AcademicERP User"}</div><div className="text-[11px] capitalize text-slate-400">{user?.role || "user"}</div></div></div>
    <div className="hidden items-center gap-1 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-500 lg:flex"><CalendarDays size={14}/> {today}</div>
  </header>;
}

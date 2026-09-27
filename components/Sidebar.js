"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, GraduationCap, UserRound, CalendarCheck, ClipboardList, RefreshCw, BarChart3, Settings, Bell, LogOut, X, BookOpen, FileCheck2 } from "lucide-react";
import { signOut } from "@/lib/auth";

const nav = {
  principal: [['Dashboard','/principal',LayoutDashboard],['Manage Users','/principal/users',Users],['Students','/principal/students',GraduationCap],['Teachers','/principal/teachers',BookOpen],['Parents','/principal/parents',UserRound],['Attendance','/principal/attendance',CalendarCheck],['Exams & Marks','/principal/marks',ClipboardList],['Change Requests','/principal/requests',RefreshCw],['Reports','/principal/reports',BarChart3],['Settings','/principal/settings',Settings]],
  teacher: [['Dashboard','/teacher',LayoutDashboard],['My Classes','/teacher/classes',BookOpen],['Students','/teacher/students',GraduationCap],['Attendance','/teacher/attendance',CalendarCheck],['Exams & Marks','/teacher/marks',ClipboardList],['Change Requests','/teacher/requests',RefreshCw],['Notifications','/teacher/notifications',Bell]],
  parent: [['Dashboard','/parent',LayoutDashboard],['My Child','/parent/child',GraduationCap],['Attendance','/parent/attendance',CalendarCheck],['Exam Results','/parent/marks',FileCheck2],['Notifications','/parent/notifications',Bell],['Settings','/parent/settings',Settings]]
};

const profile = {
  principal: { initials: 'DR', name: 'Principal' },
  teacher: { initials: 'MS', name: 'Teacher' },
  parent: { initials: 'DP', name: 'Parent' },
};

export default function Sidebar({ role, open, onClose, pending = 0, user = null }) {
  const pathname = usePathname();
  const router = useRouter();
  const p = profile[role] || profile.principal;
  const name = user?.full_name || p.name;
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const logout = () => { signOut(); router.replace('/login'); };
  return <aside className={`${open ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col bg-[#090b0f] text-white transition-transform lg:static lg:translate-x-0`}>
    <div className="flex h-[72px] items-center justify-between border-b border-white/10 px-5"><Link href={`/${role}`} className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-lg bg-red-600"><GraduationCap size={22}/></div><div><div className="font-black">Academic<span className="text-red-500">ERP</span></div><div className="text-[9px] text-slate-500">AI-ERP ALPHA</div></div></Link><button onClick={onClose} className="lg:hidden"><X size={18}/></button></div>
    <div className="flex-1 overflow-y-auto p-3 erp-scrollbar"><div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">{role} workspace</div>{nav[role].map(([label, href, Icon]) => { const active = pathname === href; const badge = label === 'Change Requests' && pending > 0 ? pending : null; return <Link key={href} href={href} onClick={onClose} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-red-600 text-white shadow-lg shadow-red-950/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Icon size={17}/><span>{label}</span>{badge !== null && <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px]">{badge}</span>}</Link> })}</div>
    <div className="border-t border-white/10 p-3"><div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 p-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-red-900 text-xs font-black">{initials}</div><div className="min-w-0"><div className="truncate text-sm font-bold">{name}</div><div className="text-[10px] capitalize text-slate-500">{user?.email || role}</div></div></div><button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-300"><LogOut size={17}/> Logout</button></div>
  </aside>;
}

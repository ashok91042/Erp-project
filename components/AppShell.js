"use client";
import { useEffect, useState } from 'react';
import Guard from './Guard';
import Sidebar from './Sidebar';
import Header from './Header';
import { getMe, getStats } from '@/lib/api';

// Shared shell: fetches the caller's profile + pending-request count once and
// passes them down so the sidebar/header always show live data.
export default function AppShell({role,title,children}){
  const [open,setOpen]=useState(false);
  const [user,setUser]=useState(null);
  const [pending,setPending]=useState(0);
  useEffect(()=>{
    getMe().then(setUser).catch(()=>setUser(null));
    // parents have no change-requests workflow — skip the stats call there
    if (role !== 'parent') getStats().then((s)=>setPending(s.pendingRequests||0)).catch(()=>setPending(0));
  },[role]);
  return <Guard role={role}><div className="erp-shell lg:flex"><Sidebar role={role} open={open} onClose={()=>setOpen(false)} pending={pending} user={user}/>{open&&<button aria-label="Close menu" onClick={()=>setOpen(false)} className="fixed inset-0 z-40 bg-black/50 lg:hidden"/>}<main className="min-w-0 flex-1"><Header title={title} onMenu={()=>setOpen(true)}/><div className="p-4 md:p-6">{children}</div></main></div></Guard>}

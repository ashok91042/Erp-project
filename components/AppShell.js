"use client";
import { useState } from 'react';
import Guard from './Guard';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppShell({role,title,children}){const[open,setOpen]=useState(false);return <Guard role={role}><div className="erp-shell lg:flex"><Sidebar role={role} open={open} onClose={()=>setOpen(false)}/>{open&&<button aria-label="Close menu" onClick={()=>setOpen(false)} className="fixed inset-0 z-40 bg-black/50 lg:hidden"/>}<main className="min-w-0 flex-1"><Header title={title} onMenu={()=>setOpen(true)}/><div className="p-4 md:p-6">{children}</div></main></div></Guard>}

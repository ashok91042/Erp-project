"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Guard({ role, children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const current = sessionStorage.getItem("erp_role");
    if (!current) router.replace("/login");
    else if (role && current !== role) router.replace(`/${current}`);
    else setReady(true);
  }, [router, role]);
  if (!ready) return <div className="min-h-screen grid place-items-center bg-slate-100 text-slate-500">Checking session…</div>;
  return children;
}

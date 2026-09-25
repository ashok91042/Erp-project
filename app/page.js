"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const role = sessionStorage.getItem("erp_role");
    router.replace(role ? `/${role}` : "/login");
  }, [router]);
  return <div className="min-h-screen grid place-items-center text-slate-500">Loading AcademicERP…</div>;
}

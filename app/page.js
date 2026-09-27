"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "@/lib/auth";

// Sign in to continue — or jump straight to the matching workspace when a
// session is already stored.
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const user = getUser();
    router.replace(`/${user?.role || "principal"}`);
  }, [router]);
  return <div className="min-h-screen grid place-items-center bg-slate-100 text-slate-500">Loading AcademicERP…</div>;
}

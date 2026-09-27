"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "@/lib/auth";

// Route protection: a protected workspace is only rendered when a session
// token exists and it belongs to this role. Otherwise redirect to /login.
export default function Guard({ role, children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const user = getUser();
    if (user?.role && role && user.role !== role) {
      router.replace(`/${user.role}`);
      return;
    }
    setReady(true);
  }, [router, role]);

  if (!ready) {
    return <div className="min-h-screen grid place-items-center bg-slate-100 text-slate-500">Checking session…</div>;
  }
  return children;
}



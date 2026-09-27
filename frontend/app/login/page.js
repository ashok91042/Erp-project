"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Eye, EyeOff, ShieldCheck, Zap, Bell, Users, FileText, Lock, Mail } from "lucide-react";
import { login } from "@/lib/api";
import { getToken, setSession, ROLES } from "@/lib/auth";

export const DEMO_ACCOUNTS = {
  principal: { email: "principal@school.edu", name: "Dr. Meera Krishnan" },
  teacher: { email: "lakshmi@school.edu", name: "Mrs. Lakshmi Menon" },
  parent: { email: "parent.demo@mail.com", name: "Demo Parent" },
};

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState("principal");
  const [email, setEmail] = useState(DEMO_ACCOUNTS.principal.email);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Already signed in? Go straight to the matching workspace.
  useEffect(() => {
    if (getToken()) router.replace(`/${role}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickRole = (r) => {
    setRole(r);
    setEmail(DEMO_ACCOUNTS[r].email);
    setPassword("");
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      const { token, user } = await login(email.trim(), password);
      setSession(token, user);
      router.push(`/${user.role || role}`);
    } catch (err) {
      setError(err.message || "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="min-h-screen hero-gradient p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between gap-4 pb-7">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-red-600 shadow-lg shadow-red-900/40"><GraduationCap size={28}/></div>
            <div><div className="text-2xl font-black">Academic<span className="text-red-500">ERP</span></div><div className="text-[10px] uppercase tracking-widest text-slate-400">AI-ERP Alpha</div></div>
          </div>
          <div className="hidden items-center gap-5 text-xs text-slate-300 md:flex">
            <span>Smarter Management</span><span>Stronger Education</span><span>Secure • Scalable • Connected</span>
          </div>
        </header>

        <section className="grid min-h-[700px] overflow-hidden rounded-3xl border border-white/10 bg-black/25 shadow-2xl backdrop-blur md:grid-cols-[.95fr_1.05fr]">
          <div className="relative hidden overflow-hidden md:block">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.88))]" />
            <div className="absolute inset-0 bg-[url('/images/campus.svg')] bg-cover bg-center opacity-70" />
            <div className="absolute bottom-0 left-0 right-0 p-10">
              <p className="mb-3 text-sm font-bold uppercase tracking-[.3em] text-red-300">Welcome to</p>
              <h1 className="text-5xl font-black leading-tight">Academic<span className="text-red-500">ERP</span></h1>
              <p className="mt-4 max-w-md text-lg text-slate-200">A smarter institution for a brighter tomorrow.</p>
              <div className="mt-8 space-y-3 text-sm text-slate-300"><div>● Learn</div><div>● Manage</div><div>● Grow</div></div>
              <p className="mt-8 italic text-slate-300">“Better Education for a Brighter Future”</p>
            </div>
          </div>

          <div className="flex items-center justify-center bg-white p-6 text-slate-900 md:p-12">
            <form onSubmit={submit} className="w-full max-w-xl">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600"><Lock size={30}/></div>
                <h2 className="text-3xl font-black">Sign in to your account</h2>
                <p className="mt-2 text-sm text-slate-500">Choose your workspace and continue to AcademicERP.</p>
              </div>
              <div className="mb-5 grid grid-cols-3 rounded-xl bg-slate-100 p-1">
                {ROLES.map((r) => (
                  <button type="button" key={r} onClick={() => pickRole(r)}
                    className={`rounded-lg px-3 py-2.5 text-sm font-bold capitalize transition ${role === r ? "bg-red-600 text-white shadow" : "text-slate-600 hover:bg-white"}`}>
                    {r}
                  </button>
                ))}
              </div>

              <label className="mb-2 block text-sm font-bold" htmlFor="email">Email address</label>
              <div className="relative mb-4">
                <Mail size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username"
                  className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 outline-none ring-red-200 focus:ring-4" placeholder="you@school.edu" />
              </div>

              <label className="mb-2 block text-sm font-bold" htmlFor="password">Password</label>
              <div className="relative">
                <input id="password" value={password} onChange={(e) => setPassword(e.target.value)} type={show ? "text" : "password"} autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none ring-red-200 focus:ring-4" placeholder="••••••••" />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-3 text-slate-400">
                  {show ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>

              {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>}

              <button disabled={busy} className="mt-6 w-full rounded-xl bg-red-600 py-3.5 font-black text-white shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:opacity-60">
                {busy ? "Signing in…" : "Login"}
              </button>
            </form>
          </div>
        </section>

        <footer className="grid gap-4 py-7 text-center text-xs text-slate-400 md:grid-cols-5">
          {[["Secure", ShieldCheck], ["Real-time", Zap], ["Notifications", Bell], ["Role-based", Users], ["Audit trail", FileText]].map(([t, I]) => (
            <div key={t} className="flex items-center justify-center gap-2"><I size={15} className="text-red-400"/>{t}</div>
          ))}
        </footer>
      </div>
    </main>
  );
}

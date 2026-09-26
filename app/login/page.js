"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Eye, EyeOff, ShieldCheck, Zap, Bell, Users, FileText } from "lucide-react";

const roles = ["principal", "teacher", "parent"];
const names = { principal: "Principal", teacher: "Teacher", parent: "Parent" };

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState("principal");
  const [email, setEmail] = useState("principal@school.edu");
  const [password, setPassword] = useState("demo123");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const existing = sessionStorage.getItem("erp_role");
    if (existing) router.replace(`/${existing}`);
  }, [router]);

  const DEMO_ACCOUNTS = {
    principal: { email: "principal@school.edu", name: "Dr. Meera Krishnan" },
    teacher: { email: "lakshmi@school.edu", name: "Mrs. Lakshmi Menon" },
    parent: { email: "parent.demo@mail.com", name: "Demo Parent" },
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || password.length < 4) {
      setError("Enter a valid email and a password with at least 4 characters.");
      return;
    }
    setBusy(true);
    try {
      // Verify the account exists on the backend (and role matches selection)
      const { api } = await import("@/lib/api");
      const health = await api("/api/health");
      if (!health?.status) throw new Error("Backend unavailable");
      const account = DEMO_ACCOUNTS[role];
      if (email.trim().toLowerCase() !== account.email) {
        setError(`Demo ${role} account is ${account.email} (any password ≥ 4 chars).`);
        return;
      }
      sessionStorage.setItem("erp_role", role);
      sessionStorage.setItem("erp_user", JSON.stringify({ name: account.name, role, email: account.email }));
      sessionStorage.setItem("erp_remember", String(remember));
      router.push(`/${role}`);
    } catch (err) {
      setError(`Login failed: ${err.message}. Is the API running on :4000?`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen hero-gradient p-4 md:p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between gap-4 pb-7">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-red-600 shadow-lg shadow-red-900/40"><GraduationCap size={28}/></div>
            <div><div className="text-2xl font-black">Academic<span className="text-red-500">ERP</span></div></div>
          </div>
          <div className="hidden items-center gap-5 text-xs text-slate-300 md:flex">
            <span>Smarter Management</span><span>Stronger Education</span><span>Secure • Scalable • Connected</span>
          </div>
        </header>

        <section className="grid min-h-[720px] overflow-hidden rounded-3xl border border-white/10 bg-black/25 shadow-2xl backdrop-blur md:grid-cols-[.95fr_1.05fr]">
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
              <div className="mb-8 text-center"><div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600"><GraduationCap size={34}/></div><h2 className="text-3xl font-black">Sign in to your account</h2><p className="mt-2 text-sm text-slate-500">Choose your role and continue to AcademicERP.</p></div>
              <div className="mb-5 grid grid-cols-3 rounded-xl bg-slate-100 p-1">
                {roles.map((r) => <button type="button" key={r} onClick={() => setRole(r)} className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${role === r ? "bg-red-600 text-white shadow" : "text-slate-600 hover:bg-white"}`}>{names[r]}</button>)}
              </div>
              <label className="mb-2 block text-sm font-bold">Email address</label>
              <input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-red-200 focus:ring-4" placeholder="you@school.edu" />
              <label className="mb-2 block text-sm font-bold">Password</label>
              <div className="relative"><input value={password} onChange={(e)=>setPassword(e.target.value)} type={show ? "text" : "password"} className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none ring-red-200 focus:ring-4" placeholder="••••••••"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-3 text-slate-400">{show ? <EyeOff size={20}/> : <Eye size={20}/>}</button></div>
              <div className="mt-4 flex items-center justify-between text-sm"><label className="flex items-center gap-2"><input checked={remember} onChange={(e)=>setRemember(e.target.checked)} type="checkbox" className="accent-red-600"/> Remember me</label><button type="button" className="font-bold text-red-600">Forgot password?</button></div>
              {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>}
              <button disabled={busy} className="mt-6 w-full rounded-xl bg-red-600 py-3.5 font-black text-white shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:opacity-60">{busy ? "Signing in…" : "Login"}</button>
            </form>
          </div>
        </section>

        <footer className="grid gap-4 py-7 text-center text-xs text-slate-400 md:grid-cols-5">
          {[['Secure', ShieldCheck], ['Real-time', Zap], ['Notifications', Bell], ['Role-based', Users], ['Audit trail', FileText]].map(([t,I])=><div key={t} className="flex items-center justify-center gap-2"><I size={15} className="text-red-400"/>{t}</div>)}
        </footer>
      </div>
    </main>
  );
}

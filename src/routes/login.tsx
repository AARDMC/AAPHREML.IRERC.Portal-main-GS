import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useGasAuth } from "@/lib/gas/auth";
import { BRAND } from "@/lib/irerc/model";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

const input =
  "w-full min-h-11 rounded-xl border border-slate-200 bg-white/95 px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100";

function LoginPage() {
  const { signIn } = useGasAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate({ to: "/" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.10),_transparent_20%),linear-gradient(135deg,#f8fbff_0%,#eef6ff_32%,#f6f8ff_100%)] px-4 py-10 text-slate-800">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -left-8 top-10 h-52 w-52 rounded-full bg-sky-200/60 blur-3xl" />
        <div className="absolute right-10 top-16 h-64 w-64 rounded-full bg-cyan-200/50 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-56 w-56 rounded-full bg-indigo-100/80 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="max-w-xl">
          <div className="mb-6 flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-sky-200 bg-white/80 shadow-[0_10px_30px_rgba(37,99,235,0.08)] backdrop-blur-sm">
              <img src="/seal.png" alt="" className="h-12 w-12 rounded-xl object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700/80">Institutional access</p>
              <h1 className="mt-1 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">{BRAND.short}</h1>
            </div>
          </div>

          <div className="rounded-[2rem] border border-sky-100 bg-white/70 p-6 shadow-[0_25px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-sky-700/80">Secure review portal</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl">Review protocols with confidence.</h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-600">
              A single authenticated pathway for investigators, reviewers, secretariat staff, and committee leadership.
              Manage submissions, reviews, decisions, and audit records in a governed environment.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Verified access", "Role-based"],
                ["Secure workflow", "Audit log"],
                ["Fast review", "All in one"],
              ].map(([title, subtitle]) => (
                <div key={title} className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700/80">{title}</p>
                  <p className="mt-2 text-sm text-slate-700">{subtitle}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-[2rem] border border-sky-100 bg-white/80 p-4 shadow-[0_30px_80px_rgba(14,116,144,0.12)] backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700/80">Welcome</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">Sign in</h3>
              </div>
              <div className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700">
                secure
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm text-slate-700">
                Email address
                <input
                  className={`${input} mt-2`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@institution.org"
                />
              </label>

              <label className="block text-sm text-slate-700">
                Password
                <input
                  className={`${input} mt-2`}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Your password"
                />
              </label>

              {error && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="min-h-12 w-full rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-indigo-500 px-4 text-sm font-bold text-white shadow-lg shadow-sky-200/70 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy ? "Please wait…" : "Sign in"}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-slate-500">
              Contact your administrator if you need an account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

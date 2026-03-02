"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuthStore } from "@/store/use-auth";

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const { token, user, login, loading, error, hydrate } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    hydrate().catch(() => null);
  }, [hydrate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    try {
      await login(email, password);
    } catch {
      // silent: error stored in state
    }
  };

  if (token && user) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto mt-20 w-full max-w-md rounded-lg border border-slate-700/60 bg-slate-900/60 p-7 shadow-[0_24px_80px_rgba(2,8,23,0.35)] backdrop-blur">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-sky-300/10 bg-slate-950/60 shadow-[0_0_32px_rgba(14,165,233,0.18)]">
        <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden="true">
          <path
            d="M32.7 8.3 27.9 31c-.36 1.61-1.3 2-2.63 1.24l-7.28-5.37-3.51 3.38c-.39.39-.72.72-1.47.72l.52-7.41L27.02 11.4c.59-.52-.13-.81-.91-.29L9.45 21.61 2.28 19.37c-1.56-.49-1.59-1.56.33-2.31L30.65 6.25c1.3-.49 2.44.29 2.05 2.05Z"
            fill="#38bdf8"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold text-white">Sign in</h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Use your admin or viewer credentials to access the activity dashboard.
      </p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-300">Email</span>
          <input
            className="h-12 rounded-md border border-slate-700 bg-slate-950/70 px-4 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            type="email"
            required
            autoComplete="email"
            autoFocus={!submitted}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@example.com"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-300">Password</span>
          <input
            className="h-12 rounded-md border border-slate-700 bg-slate-950/70 px-4 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </label>
        <button
            type="submit"
            className="h-12 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_0_28px_rgba(37,99,235,0.35)] hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </form>
      <p className="mt-4 text-xs text-slate-500">
        Access is restricted: tracked users must provide explicit consent. Admins can manage the consent basis and data
        retention from the backend API.
      </p>
    </div>
  );
}

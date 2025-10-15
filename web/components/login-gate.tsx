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
    <div className="mx-auto w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100">Sign in</h2>
      <p className="mt-2 text-sm text-slate-400">
        Use your admin or viewer credentials to access the activity dashboard.
      </p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-300">Email</span>
          <input
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            type="email"
            required
            autoFocus={!submitted}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@example.com"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-300">Password</span>
          <input
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </label>
        <button
            type="submit"
            className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
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

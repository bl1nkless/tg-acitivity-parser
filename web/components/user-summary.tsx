"use client";

import { format } from "date-fns";
import type { TrackedUser } from "@/lib/api";

interface UserSummaryProps {
  user: TrackedUser;
}

export default function UserSummary({ user }: UserSummaryProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-200 shadow">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            {user.display_name || user.username || user.tg_user_id}
          </h2>
          <p className="text-xs text-slate-400">ID {user.tg_user_id}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-300">
          <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 font-medium uppercase tracking-wide text-emerald-300">
            {user.consent_basis}
          </span>
          <span className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1">
            TZ {user.tz}
          </span>
          <span className="rounded border border-slate-700 bg-slate-800 px-2 py-1">
            Added {format(new Date(user.added_at), "yyyy-MM-dd")}
          </span>
        </div>
      </div>
      {user.notes && <p className="mt-3 text-sm text-slate-300">Notes: {user.notes}</p>}
      {user.consent_reference && (
        <p className="mt-2 text-xs text-slate-400">Consent reference: {user.consent_reference}</p>
      )}
    </div>
  );
}

"use client";

import { format } from "date-fns";
import type { TrackedUser } from "@/lib/api";

interface UserSummaryProps {
  user: TrackedUser;
}

export default function UserSummary({ user }: UserSummaryProps) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 p-5 text-sm text-slate-200 shadow-[0_18px_50px_rgba(2,8,23,0.24)]">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[20px] font-semibold text-white">
            {user.display_name || user.username || user.tg_user_id}
          </h2>
          <p className="mt-1 text-sm text-slate-400">ID {user.tg_user_id}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-300">

          <span className="rounded-md border border-sky-400/30 bg-sky-500/10 px-3 py-1.5">
            TZ {user.tz}
          </span>
          <span className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-1.5">
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

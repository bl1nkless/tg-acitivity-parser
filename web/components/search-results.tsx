"use client";

import type { TrackedUser } from "@/lib/api";

interface SearchResultsProps {
  results: TrackedUser[];
  onSelect: (user: TrackedUser) => void;
  selectedId?: number;
}

export default function SearchResults({ results, onSelect, selectedId }: SearchResultsProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 text-sm text-slate-100">
      {results.length === 0 && (
        <p className="p-4 text-sm text-slate-500">Start typing a username or ID to find tracked users.</p>
      )}
      <ul className="divide-y divide-slate-800">
        {results.map((user) => {
          const isSelected = selectedId === user.tg_user_id;
          return (
            <li
              key={user.tg_user_id}
              className={`cursor-pointer px-4 py-3 transition-colors ${
                isSelected ? "bg-sky-600/20" : "hover:bg-slate-800/70"
              }`}
              onClick={() => onSelect(user)}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {user.display_name || user.username || user.tg_user_id}
                    {user.username && <span className="text-xs text-slate-400"> @{user.username}</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    Consent {user.consent_basis} · Enabled {user.track_enabled ? "yes" : "no"}
                  </p>
                </div>
                <span className="text-xs text-slate-500">ID {user.tg_user_id}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

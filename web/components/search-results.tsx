"use client";

import type { TrackedUser } from "@/lib/api";

interface SearchResultsProps {
  results: TrackedUser[];
  onSelect: (user: TrackedUser) => void;
  selectedId?: number;
}

export default function SearchResults({ results, onSelect, selectedId }: SearchResultsProps) {
  return (
    <div className="text-sm text-slate-100">
      {results.length > 0 && (
      <ul className="divide-y divide-slate-700/60 overflow-hidden rounded-lg border border-slate-700/70 bg-slate-950/30">
        {results.map((user) => {
          const isSelected = selectedId === user.tg_user_id;
          return (
            <li
              key={user.tg_user_id}
              className={`cursor-pointer px-5 py-4 transition-colors ${
                isSelected ? "bg-sky-500/20" : "hover:bg-slate-800/60"
              }`}
              onClick={() => onSelect(user)}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-white">
                    {user.display_name || user.username || user.tg_user_id}
                    {user.username && <span className="text-xs text-slate-400"> @{user.username}</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    Enabled {user.track_enabled ? "yes" : "no"}
                  </p>
                </div>
                <span className="text-xs text-slate-500">ID {user.tg_user_id}</span>
              </div>
            </li>
          );
        })}
      </ul>
      )}
    </div>
  );
}

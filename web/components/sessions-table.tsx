"use client";

import { differenceInSeconds, format } from "date-fns";
import type { Session } from "@/lib/api";

interface SessionsTableProps {
  now: Date;
  sessions: Session[];
}

function formatElapsed(seconds: number): string {
  const total = Math.max(0, seconds);
  if (total < 1) return "<1s";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes || hours) parts.push(`${minutes}m`);
  if (!hours && (secs || !minutes)) parts.push(`${secs}s`);
  return parts.join(" ");
}

function formatDuration(start: Date, end: Date): string {
  const seconds = differenceInSeconds(end, start);
  return formatElapsed(seconds);
}

function formatActiveDuration(start: Date, now: Date): string {
  const seconds = differenceInSeconds(now, start);
  return `Active ${formatElapsed(seconds)}`;
}

export default function SessionsTable({ sessions, now }: SessionsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-950/60 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-2 text-left">From</th>
            <th className="px-4 py-2 text-left">To</th>
            <th className="px-4 py-2 text-left">Duration</th>
            <th className="px-4 py-2 text-left">Precision</th>
            <th className="px-4 py-2 text-left">Closed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-slate-200">
          {sessions.map((session) => {
            const tsFrom = new Date(session.ts_from);
            const tsTo = session.ts_to ? new Date(session.ts_to) : null;
            const durationLabel = tsTo ? formatDuration(tsFrom, tsTo) : formatActiveDuration(tsFrom, now);
            return (
              <tr key={session.id} className="hover:bg-slate-800/60">
                <td className="px-4 py-2">{format(tsFrom, "yyyy-MM-dd HH:mm:ss")}</td>
                <td className="px-4 py-2">{tsTo ? format(tsTo, "yyyy-MM-dd HH:mm:ss") : <span>—</span>}</td>
                <td className="px-4 py-2">{durationLabel}</td>
                <td className="px-4 py-2 capitalize">{session.source_precision}</td>
                <td className="px-4 py-2 capitalize">{session.closed_reason ?? (tsTo ? "—" : "active")}</td>
              </tr>
            );
          })}
          {sessions.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                No sessions yet for this range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

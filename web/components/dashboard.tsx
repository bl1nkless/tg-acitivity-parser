"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, differenceInSeconds } from "date-fns";
import {
  API_BASE_URL,
  createChatAuthorJob,
  createTrackedUser,
  getChatActiveAuthors,
  getChatAuthorJob,
  getCurrentUser,
  getHeatmapData,
  getHourlyData,
  getRecentSessions,
  getTrackedUser,
  login,
  resolveTelegramChat,
  searchTrackedUsers,
  type ChatActiveAuthor,
  type ChatAuthorJob,
  type Heatmap,
  type Session,
  type TelegramChat,
  type TrackedUser,
  type UserInfo
} from "@/lib/api";
import SearchResults from "./search-results";
import UserSummary from "./user-summary";
import HeatmapChart from "./charts/HeatmapChart";
import HourlyDistributionChart from "./charts/HourlyDistributionChart";
import TrendLineChart from "./charts/TrendLineChart";
import SessionsTable from "./sessions-table";

const AUTO_LOGIN_EMAIL = process.env.NEXT_PUBLIC_AUTO_LOGIN_EMAIL ?? "admin@example.com";
const AUTO_LOGIN_PASSWORD = process.env.NEXT_PUBLIC_AUTO_LOGIN_PASSWORD ?? "ChangeMe123!";

function SidebarIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-[14px] text-slate-300 transition group-hover:text-sky-300">
      {children}
    </div>
  );
}

function TelegramMark() {
  return (
    <div className="mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-full border border-sky-300/10 bg-slate-900/70 shadow-[0_0_32px_rgba(14,165,233,0.18)]">
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden="true">
        <path
          d="M32.7 8.3 27.9 31c-.36 1.61-1.3 2-2.63 1.24l-7.28-5.37-3.51 3.38c-.39.39-.72.72-1.47.72l.52-7.41L27.02 11.4c.59-.52-.13-.81-.91-.29L9.45 21.61 2.28 19.37c-1.56-.49-1.59-1.56.33-2.31L30.65 6.25c1.3-.49 2.44.29 2.05 2.05Z"
          fill="url(#telegram-gradient)"
        />
        <defs>
          <linearGradient id="telegram-gradient" x1="6" y1="30" x2="32" y2="7">
            <stop stopColor="#38bdf8" />
            <stop offset="1" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function DashboardShell({ children, activeTab, onTabChange }: { children: ReactNode, activeTab: string, onTabChange: (tab: string) => void }) {
  const navItems = [
    {
      label: "Tracked Users",
      active: activeTab === "Tracked Users",
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path d="M8 7h8M8 12h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="5" y="3.5" width="14" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    },
    {
      label: "Analytics",
      active: activeTab === "Analytics",
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path d="M6 18V13M12 18V6M18 18v-9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M6 20h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )
    },
    {
      label: "Chat Authors",
      active: activeTab === "Chat Authors",
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path d="M7 8.5h10M7 12h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M5.5 4.5h13A2.5 2.5 0 0 1 21 7v7a2.5 2.5 0 0 1-2.5 2.5H12L7 20v-3.5H5.5A2.5 2.5 0 0 1 3 14V7a2.5 2.5 0 0 1 2.5-2.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Export",
      active: activeTab === "Export",
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path d="M12 4v10m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 17.5V20h14v-2.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
  ];
  const utilityItems = [
    {
      label: "Settings",
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M19 13.4v-2.8l-2.05-.43a5.7 5.7 0 0 0-.56-1.36l1.15-1.75-1.98-1.98-1.75 1.15c-.43-.23-.89-.42-1.36-.56L12 3.6H9.2l-.43 2.07c-.48.14-.93.33-1.36.56L5.66 5.08 3.68 7.06l1.15 1.75c-.23.43-.42.88-.56 1.36l-2.07.43v2.8l2.07.43c.14.48.33.93.56 1.36l-1.15 1.75 1.98 1.98 1.75-1.15c.43.23.88.42 1.36.56l.43 2.07H12l.43-2.07c.48-.14.93-.33 1.36-.56l1.75 1.15 1.98-1.98-1.15-1.75c.23-.43.42-.88.56-1.36L19 13.4Z" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "Help",
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9.8 9.5A2.4 2.4 0 0 1 12.22 7c1.42 0 2.48.88 2.48 2.15 0 1.06-.6 1.6-1.54 2.2-.78.5-1.14.92-1.14 1.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 16.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_42%_0%,rgba(37,99,235,0.2),transparent_36%),linear-gradient(135deg,#050b19_0%,#020817_45%,#010614_100%)] text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[140px] border-r border-slate-700/60 bg-slate-950/60 shadow-[24px_0_70px_rgba(2,8,23,0.45)] backdrop-blur-xl lg:flex lg:flex-col">
        <div className="px-8 pt-8">
          <TelegramMark />
        </div>
        <nav className="mt-7 flex flex-1 flex-col justify-between">
          <div className="space-y-2">
            {navItems.map((item) => (
              <div
                key={item.label}
                onClick={() => onTabChange(item.label)}
                className={`group flex flex-col items-center gap-1.5 px-2 py-4 cursor-pointer text-center text-[15px] font-medium transition-colors ${
                  item.active
                    ? "border-l-2 border-sky-400 bg-sky-500/10 text-sky-300 shadow-[inset_0_0_28px_rgba(14,165,233,0.18)]"
                    : "text-slate-400 hover:text-sky-200"
                }`}
              >
                <SidebarIcon>{item.icon}</SidebarIcon>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="pb-9">
            {utilityItems.map((item) => (
              <div
                key={item.label}
                className="group flex flex-col items-center gap-1.5 px-2 py-3 text-center text-[15px] font-medium text-slate-400 hover:text-sky-200"
              >
                <SidebarIcon>{item.icon}</SidebarIcon>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </nav>
      </aside>
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800/70 bg-slate-950/80 px-5 py-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-sky-300/10 bg-slate-900/80">
            <svg viewBox="0 0 40 40" className="h-6 w-6" aria-hidden="true">
              <path
                d="M32.7 8.3 27.9 31c-.36 1.61-1.3 2-2.63 1.24l-7.28-5.37-3.51 3.38c-.39.39-.72.72-1.47.72l.52-7.41L27.02 11.4c.59-.52-.13-.81-.91-.29L9.45 21.61 2.28 19.37c-1.56-.49-1.59-1.56.33-2.31L30.65 6.25c1.3-.49 2.44.29 2.05 2.05Z"
                fill="#38bdf8"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold text-sky-300">{activeTab}</span>
        </div>
      </div>
      <div className="mx-auto min-h-screen w-full max-w-[1510px] px-5 py-8 sm:px-8 lg:pl-[180px] lg:pr-8 xl:pl-[180px] xl:pr-12">
        {children}
      </div>
    </div>
  );
}

function UsersGlyph({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path d="M12.5 15.5a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" stroke="currentColor" strokeWidth="2.2" />
      <path d="M3.8 26c.85-4.55 4.2-7.25 8.7-7.25 4.48 0 7.85 2.7 8.7 7.25" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M22.7 14.5a4 4 0 1 0-1.35-7.77" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M21.8 18.7c3.35.4 5.72 2.7 6.4 6.3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

interface DashboardState {
  heatmap: Heatmap | null;
  hourly: Array<{ bucket_start: string; online_seconds: number }>;
  sessions: Session[];
  loadingData: boolean;
  error?: string | null;
}

const initialState: DashboardState = {
  heatmap: null,
  hourly: [],
  sessions: [],
  loadingData: false,
  error: null
};

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

function AnalyticsView({ 
  state, 
  selectedUser, 
  now, 
  handleExport 
}: { 
  state: DashboardState; 
  selectedUser: TrackedUser | null; 
  now: Date; 
  handleExport: (format: "csv" | "json") => void;
}) {
  const sessions = state.sessions || [];
  
  // Calculate metrics
  const todaySessions = sessions.filter(s => new Date(s.ts_from).toDateString() === now.toDateString());
  const onlineTodaySeconds = todaySessions.reduce((acc, s) => {
    const end = s.ts_to ? new Date(s.ts_to) : now;
    return acc + differenceInSeconds(end, new Date(s.ts_from));
  }, 0);
  
  const heatmapCells = state.heatmap?.cells || [];
  const maxIntensity = Math.max(...heatmapCells.map(c => c.online_seconds), 1);
  return (
    <div className="flex flex-col gap-6 rounded-lg border border-slate-700/60 bg-slate-900/45 p-6 shadow-[0_24px_80px_rgba(2,8,23,0.3)] backdrop-blur md:p-9">
      <div className="flex flex-col gap-2">
        <h2 className="text-[20px] font-semibold tracking-normal text-white">Analytics</h2>
        <p className="text-[14px] leading-[1.35] text-slate-300/80">
          Activity patterns based on consented online/offline session data.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid w-full grid-cols-1 gap-4 sm:flex sm:w-auto">
          <div className="relative w-full sm:w-[220px]">
            <select className="h-10 w-full appearance-none rounded-md border border-slate-700/60 bg-slate-950/40 pl-4 pr-10 text-[14px] text-slate-200 shadow-inner shadow-slate-950/20 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50">
              <option>{selectedUser?.username ? `@${selectedUser.username}` : selectedUser?.display_name || "Select user"}</option>
            </select>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none">
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          
          <div className="relative w-full sm:w-[260px]">
            <div className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-700/60 bg-slate-950/40 px-4 text-[14px] text-slate-200 shadow-inner shadow-slate-950/20">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>May 4 – May 10, 2026</span>
            </div>
          </div>

          <div className="relative w-full sm:w-[240px]">
            <select className="h-10 w-full appearance-none rounded-md border border-slate-700/60 bg-slate-950/40 pl-4 pr-10 text-[14px] text-slate-200 shadow-inner shadow-slate-950/20 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50">
              <option>Local time (UTC+3)</option>
              <option>UTC</option>
            </select>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none">
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        
        <button 
          onClick={() => handleExport("csv")}
          disabled={!selectedUser}
          className="h-10 rounded-md bg-[#0ea5e9] px-6 text-[14px] font-medium text-white shadow-[0_0_20px_rgba(14,165,233,0.3)] transition hover:bg-[#0284c7] disabled:opacity-50 disabled:shadow-none"
        >
          Export report
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Online today", value: selectedUser ? formatElapsed(onlineTodaySeconds) : "—" },
          { label: "Sessions", value: selectedUser ? sessions.length.toString() : "—" },
          { label: "Active window", value: selectedUser ? "09:00–18:00" : "—" },
          { label: "Data coverage", value: selectedUser ? "98%" : "—" }
        ].map((metric) => (
          <div key={metric.label} className="rounded-md border border-slate-700/50 bg-slate-900/40 p-4">
            <div className="text-[13px] text-slate-400">{metric.label}</div>
            <div className="mt-1 text-[20px] font-medium text-white">{metric.value}</div>
          </div>

        ))}
      </div>

      <div className="rounded-md border border-slate-700/50 bg-slate-900/30 p-6">
        <h3 className="text-[14px] font-semibold text-white">Activity heatmap</h3>
        <div className="mt-4 flex">
          <div className="flex w-[40px] flex-col justify-between py-1 text-[11px] leading-none text-slate-400">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-[repeat(24,1fr)] gap-[2px]">
              {Array.from({ length: 7 * 24 }).map((_, i) => {
                const hour = i % 24;
                const weekday = Math.floor(i / 24); // 0=Mon, 6=Sun
                const cell = heatmapCells.find(c => c.weekday === weekday && c.hour === hour);
                const intensity = cell ? Math.max(10, Math.floor((cell.online_seconds / maxIntensity) * 100)) : 0;
                
                return (
                  <div 
                    key={i} 
                    className="aspect-square w-full rounded-[2px]" 
                    style={{ 
                      backgroundColor: intensity > 0 ? `rgba(14, 165, 233, ${intensity / 100})` : 'rgba(30, 41, 59, 0.4)' 
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-[repeat(24,1fr)] text-center text-[10px] text-slate-400">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i}>{String(i).padStart(2, "0")}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-slate-700/50 bg-slate-900/30 p-6">
        <h3 className="text-[14px] font-semibold text-white">Session timeline (Today)</h3>
        <div className="mt-4">
          <div className="relative h-2 w-full rounded-full bg-slate-800/80">
            {todaySessions.map((session, i) => {
               const start = new Date(session.ts_from);
               const end = session.ts_to ? new Date(session.ts_to) : now;
               const startSeconds = start.getHours() * 3600 + start.getMinutes() * 60 + start.getSeconds();
               const durationSeconds = differenceInSeconds(end, start);
               const leftPct = (startSeconds / 86400) * 100;
               const widthPct = (durationSeconds / 86400) * 100;
               return (
                 <div key={i} className="absolute h-full rounded-full bg-[#0ea5e9]" style={{ left: `${leftPct}%`, width: `${widthPct}%` }}></div>
               );
            })}
          </div>
          <div className="mt-3 flex justify-between text-[11px] text-slate-400">
            <span>00:00</span>
            <span>04:00</span>
            <span>08:00</span>
            <span>12:00</span>
            <span>16:00</span>
            <span>20:00</span>
            <span>24:00</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 p-5 shadow-[0_18px_50px_rgba(2,8,23,0.22)]">
        <h3 className="text-lg font-semibold text-white">Recent sessions</h3>
        <p className="mt-1 text-xs text-slate-500">
          Raw session intervals with closure reason. Offline accuracy depends on the Telegram privacy settings of the user.
        </p>
        
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-700/60 bg-slate-950/20">
          <table className="min-w-full divide-y divide-slate-700/60 text-sm text-left">
            <thead className="bg-slate-950/45 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">From</th>
                <th className="px-4 py-2 font-medium">To</th>
                <th className="px-4 py-2 font-medium">Duration</th>
                <th className="px-4 py-2 font-medium">Precision</th>
                <th className="px-4 py-2 font-medium">Closed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 text-slate-200">
              {sessions.slice(0, 15).map((session) => {
                const start = new Date(session.ts_from);
                const end = session.ts_to ? new Date(session.ts_to) : now;
                const duration = differenceInSeconds(end, start);
                return (
                  <tr key={session.id} className="hover:bg-slate-800/45">
                    <td className="px-4 py-2">{format(start, "yyyy-MM-dd HH:mm:ss")}</td>
                    <td className="px-4 py-2">{session.ts_to ? format(end, "yyyy-MM-dd HH:mm:ss") : <span>—</span>}</td>
                    <td className="px-4 py-2">{formatElapsed(duration)}</td>
                    <td className="px-4 py-2 capitalize">{session.source_precision}</td>
                    <td className="px-4 py-2 capitalize">{session.closed_reason ?? (session.ts_to ? "—" : "active")}</td>
                  </tr>
                );
              })}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No sessions yet for this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ChatAuthorsView({ token, isAdmin }: { token: string | null; isAdmin: boolean }) {
  const [chatRef, setChatRef] = useState("");
  const [periodDays, setPeriodDays] = useState(7);
  const [resolvedChat, setResolvedChat] = useState<TelegramChat | null>(null);
  const [job, setJob] = useState<ChatAuthorJob | null>(null);
  const [authors, setAuthors] = useState<ChatActiveAuthor[]>([]);
  const [totalAuthors, setTotalAuthors] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAuthors = useCallback(
    async (chat: TelegramChat, days: number) => {
      if (!token) return;
      const response = await getChatActiveAuthors(token, chat.telegram_chat_id, days, 100);
      setAuthors(response.items);
      setTotalAuthors(response.total);
      if (response.latest_job) {
        setJob(response.latest_job);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token || !resolvedChat || !job) return;
    if (!["queued", "running", "paused_flood_wait"].includes(job.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const fresh = await getChatAuthorJob(token, job.id);
        setJob(fresh);
        if (fresh.status === "completed") {
          await loadAuthors(resolvedChat, fresh.lookback_days);
        }
      } catch (pollError) {
        console.error(pollError);
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [job, loadAuthors, resolvedChat, token]);

  const handleResolve = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const chat = await resolveTelegramChat(token, chatRef.trim());
      setResolvedChat(chat);
      setAuthors([]);
      setTotalAuthors(0);
      setJob(null);
      await loadAuthors(chat, periodDays);
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Failed to resolve Telegram chat.");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!token || !resolvedChat) return;
    setLoading(true);
    setError(null);
    try {
      const started = await createChatAuthorJob(token, resolvedChat.telegram_chat_id, periodDays);
      setJob(started);
      setAuthors([]);
      setTotalAuthors(0);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start chat author scan.");
    } finally {
      setLoading(false);
    }
  };

  const exportAuthors = async (format: "csv" | "json") => {
    if (!token || !resolvedChat) return;
    const response = await fetch(
      `${API_BASE_URL}/telegram/chats/${resolvedChat.telegram_chat_id}/active-authors.${format}?period_days=${periodDays}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) {
      setError("Failed to export chat authors.");
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chat_authors_${resolvedChat.telegram_chat_id}.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  const jobStatusText = job
    ? `${job.status.replaceAll("_", " ")} · ${job.scanned_messages_count} messages · ${job.unique_authors_count} authors`
    : "No scan started yet.";

  return (
    <section className="rounded-lg border border-slate-700/60 bg-slate-900/45 p-6 shadow-[0_24px_80px_rgba(2,8,23,0.3)] backdrop-blur md:p-9">
      <div className="flex flex-col gap-3">
        <h2 className="text-[26px] font-semibold tracking-normal text-white">Chat Authors</h2>
        <p className="max-w-[720px] text-[16px] leading-[1.45] text-slate-300/80">
          Resolve a Telegram chat, scan recent message history, and collect only author metadata and activity counts.
        </p>
        <p className="rounded-md border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          The collector does not auto-join chats and does not store message text or media. It can only read chats visible
          to the authorized Telegram session.
        </p>
      </div>

      <form className="mt-7 grid gap-4 rounded-lg border border-slate-700/70 bg-slate-950/35 p-5 lg:grid-cols-[minmax(0,1fr)_160px_170px_170px]" onSubmit={handleResolve}>
        <input
          type="text"
          value={chatRef}
          onChange={(event) => setChatRef(event.target.value)}
          placeholder="Chat username or ID"
          className="h-[52px] rounded-md border border-slate-700 bg-slate-900/70 px-5 text-[16px] text-slate-100 placeholder:text-slate-400/90 shadow-inner shadow-slate-950/30 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
        />
        <select
          value={periodDays}
          onChange={(event) => setPeriodDays(Number(event.target.value))}
          className="h-[52px] rounded-md border border-slate-700 bg-slate-900/70 px-4 text-[16px] text-slate-100 shadow-inner shadow-slate-950/30 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
        >
          {[1, 3, 7, 14, 30].map((days) => (
            <option key={days} value={days}>
              {days}d
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!token || loading || !chatRef.trim()}
          className="h-[52px] rounded-md border border-sky-400/45 bg-sky-500/10 px-5 text-[16px] font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/50 disabled:text-slate-500"
        >
          {loading ? "Working..." : "Resolve"}
        </button>
        <button
          type="button"
          onClick={handleStart}
          disabled={!isAdmin || !resolvedChat || loading}
          className="flex h-[52px] items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-[16px] font-semibold text-white shadow-[0_0_28px_rgba(37,99,235,0.35)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M8 5v14l11-7L8 5Z" fill="currentColor" />
          </svg>
          Start
        </button>
      </form>

      {error && <div className="mt-5 rounded-lg border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-slate-700/60 bg-slate-950/30 p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Resolved chat</p>
          {resolvedChat ? (
            <div className="mt-3 space-y-1 text-slate-200">
              <p className="text-lg font-semibold text-white">{resolvedChat.title || resolvedChat.username || resolvedChat.telegram_chat_id}</p>
              <p className="text-sm text-slate-400">@{resolvedChat.username || "no_username"} · {resolvedChat.chat_type} · {resolvedChat.telegram_chat_id}</p>
            </div>
          ) : (
            <p className="mt-3 text-slate-400">Resolve a chat to start collecting active authors.</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-950/30 p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Scan status</p>
          <p className="mt-3 text-lg font-semibold capitalize text-white">{jobStatusText}</p>
          {job?.flood_wait_until && (
            <p className="mt-2 text-sm text-amber-200">Paused until {format(new Date(job.flood_wait_until), "yyyy-MM-dd HH:mm:ss")}</p>
          )}
          {job?.error_message && <p className="mt-2 text-sm text-rose-300">{job.error_message}</p>}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-700/60 bg-slate-950/30">
        <div className="flex flex-col gap-3 border-b border-slate-700/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Active authors</h3>
            <p className="text-sm text-slate-400">{totalAuthors} authors in the latest completed {periodDays}d scan.</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-md border border-sky-400/45 bg-sky-500/10 px-4 py-2 text-sm text-sky-100 transition hover:bg-sky-500/20" onClick={() => exportAuthors("csv")} disabled={!resolvedChat}>
              Export CSV
            </button>
            <button className="rounded-md border border-slate-700 bg-slate-800/70 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-700" onClick={() => exportAuthors("json")} disabled={!resolvedChat}>
              Export JSON
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Telegram ID</th>
                <th className="px-5 py-3">Messages</th>
                <th className="px-5 py-3">First message</th>
                <th className="px-5 py-3">Last message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {authors.map((author) => (
                <tr key={author.telegram_user_id}>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-white">
                      {author.username ? `@${author.username}` : [author.first_name, author.last_name].filter(Boolean).join(" ") || "Unknown"}
                    </div>
                    <div className="text-xs text-slate-500">{author.is_bot ? "bot" : "user"}</div>
                  </td>
                  <td className="px-5 py-4 font-mono text-slate-300">{author.telegram_user_id}</td>
                  <td className="px-5 py-4">{author.message_count}</td>
                  <td className="px-5 py-4">{format(new Date(author.first_message_at), "yyyy-MM-dd HH:mm:ss")}</td>
                  <td className="px-5 py-4">{format(new Date(author.last_message_at), "yyyy-MM-dd HH:mm:ss")}</td>
                </tr>
              ))}
              {!authors.length && (
                <tr>
                  <td className="px-5 py-12 text-center text-slate-500" colSpan={5}>
                    No completed author scan results yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("Analytics");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [results, setResults] = useState<TrackedUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<TrackedUser | null>(null);
  const [state, setState] = useState<DashboardState>(initialState);
  const [searchLoading, setSearchLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    tg_user_id: "",
    username: "",
    display_name: "",

    tz: "Europe/Kyiv"
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const latestRequestRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    setAuthLoading(true);
    setAuthError(null);
    login(AUTO_LOGIN_EMAIL, AUTO_LOGIN_PASSWORD)
      .then(async (tokenResponse) => {
        const accessToken = tokenResponse.access_token;
        const currentUser = await getCurrentUser(accessToken);
        if (!cancelled) {
          setToken(accessToken);
          setUser(currentUser);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : "Unable to initialize dashboard access.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token) {
      setResults([]);
      return;
    }
    if (debouncedSearch.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    searchTrackedUsers(token, debouncedSearch)
      .then((response) => {
        if (!cancelled) {
          setResults(response.items);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error(error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSearchLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, token]);

  const fetchUserData = useCallback(
    async (userId: number, { silent = false }: { silent?: boolean } = {}) => {
      if (!token) return;
      const requestId = Date.now();
      latestRequestRef.current = requestId;
      if (!silent) {
        setState((prev) => ({ ...prev, loadingData: true, error: null }));
      }
      try {
        const [userDetails, heatmap, hourly, sessions] = await Promise.all([
          getTrackedUser(token, userId),
          getHeatmapData(token, userId),
          getHourlyData(token, userId),
          getRecentSessions(token, userId, 15)
        ]);
        if (latestRequestRef.current !== requestId) {
          return;
        }
        setSelectedUser(userDetails);
        setState({
          heatmap,
          hourly,
          sessions: sessions.items,
          loadingData: false,
          error: null
        });
      } catch (error) {
        if (latestRequestRef.current !== requestId) {
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to load data";
        setState((prev) => ({ ...prev, loadingData: false, error: message }));
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token || !selectedUser) {
      setState(initialState);
      return;
    }
    fetchUserData(selectedUser.tg_user_id);
  }, [fetchUserData, selectedUser?.tg_user_id, token]);

  useEffect(() => {
    if (!token || !selectedUser) return;
    const userId = selectedUser.tg_user_id;
    const interval = window.setInterval(() => {
      fetchUserData(userId, { silent: true });
    }, 15000);
    return () => window.clearInterval(interval);
  }, [fetchUserData, selectedUser?.tg_user_id, token]);

  const handleExport = async (format: "csv" | "json") => {
    if (!selectedUser || !token) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${selectedUser.tg_user_id}/export/sessions.${format}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (!response.ok) {
        throw new Error("Failed to export sessions");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `sessions_${selectedUser.tg_user_id}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateTracked = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    const trimmedTelegramId = createForm.tg_user_id.trim();
    const trimmedUsername = createForm.username.trim().replace(/^@+/, "");
    const parsedTelegramId = trimmedTelegramId ? Number(trimmedTelegramId) : undefined;
    if (
      parsedTelegramId !== undefined &&
      (!Number.isInteger(parsedTelegramId) || parsedTelegramId <= 0)
    ) {
      setCreateError("Telegram ID must be a positive number.");
      setCreateSuccess(null);
      return;
    }
    const tgUserId = parsedTelegramId;
    if (!tgUserId && !trimmedUsername) {
      setCreateError("Enter a Telegram ID or username.");
      setCreateSuccess(null);
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const created = await createTrackedUser(token, {
        tg_user_id: tgUserId,
        username: trimmedUsername || undefined,
        display_name: createForm.display_name.trim() || undefined,

        tz: createForm.tz.trim() || "Europe/Kyiv"
      });
      setSelectedUser(created);
      setResults((prev) => {
        const withoutDuplicate = prev.filter((item) => item.tg_user_id !== created.tg_user_id);
        return [created, ...withoutDuplicate];
      });
      setSearch(created.username ? `@${created.username}` : String(created.tg_user_id));
      setCreateForm({
        tg_user_id: "",
        username: "",
        display_name: "",

        tz: "Europe/Kyiv"
      });
      setCreateSuccess("Tracked user added.");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to add tracked user.");
    } finally {
      setCreateLoading(false);
    }
  };

  const summaryHeatmap = useMemo(() => state.heatmap?.cells ?? [], [state.heatmap]);
  const summaryHourly = useMemo(() => state.hourly, [state.hourly]);

  return (
    <DashboardShell activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-6 pt-4 text-slate-200 md:flex-row md:items-start md:justify-between lg:pt-8">
          <div className="max-w-[560px]">
            <h1 className="text-[34px] font-semibold leading-tight tracking-normal text-white md:text-[38px]">
              Telegram activity dashboard
            </h1>
            <p className="mt-4 max-w-[520px] text-[18px] leading-[1.35] text-slate-300/85">
              Inspect online/offline sessions, consent metadata, aggregated heatmaps, and export evidence.
            </p>
          </div>
          {(authLoading || authError) && (
            <div
              className={`rounded-lg border px-5 py-3 text-sm ${
                authError
                  ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                  : "border-slate-700/60 bg-slate-900/55 text-slate-300"
              }`}
            >
              {authError || "Connecting to dashboard data..."}
            </div>
          )}
        </header>

        {activeTab === "Tracked Users" && (
          <>
            <section className="rounded-lg border border-slate-700/60 bg-slate-900/45 p-6 shadow-[0_24px_80px_rgba(2,8,23,0.3)] backdrop-blur md:p-9">
          <div className="flex items-start gap-5">
            <UsersGlyph className="mt-1 h-9 w-9 text-blue-500" />
            <div>
              <h2 className="text-[26px] font-semibold tracking-normal text-white">Tracked users</h2>
              <p className="mt-3 max-w-[610px] text-[17px] leading-[1.35] text-slate-300/80">
                Search by username, display name, or Telegram ID.
                <br />
                Only users with explicit consent are visible.
              </p>
            </div>
          </div>
          {user?.role === "admin" && (
            <form
              className="mt-8 grid gap-5 rounded-lg border border-slate-700/70 bg-slate-950/35 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)_172px]"
              onSubmit={handleCreateTracked}
            >
              <input
                type="number"
                min="1"
                value={createForm.tg_user_id}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, tg_user_id: event.target.value }))
                }
                placeholder="Telegram ID (optional)"
                className="h-[54px] rounded-md border border-slate-700 bg-slate-900/70 px-5 text-[16px] text-slate-100 placeholder:text-slate-400/90 shadow-inner shadow-slate-950/30 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
              <input
                type="text"
                value={createForm.username}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="Username or @username"
                className="h-[54px] rounded-md border border-slate-700 bg-slate-900/70 px-5 text-[16px] text-slate-100 placeholder:text-slate-400/90 shadow-inner shadow-slate-950/30 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
              <input
                type="text"
                value={createForm.display_name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, display_name: event.target.value }))
                }
                placeholder="Display name"
                className="h-[54px] rounded-md border border-slate-700 bg-slate-900/70 px-5 text-[16px] text-slate-100 placeholder:text-slate-400/90 shadow-inner shadow-slate-950/30 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />

              <button
                type="submit"
                disabled={createLoading}
                className="flex h-[54px] items-center justify-center gap-3 rounded-md bg-blue-600 px-5 text-[16px] font-semibold text-white shadow-[0_0_28px_rgba(37,99,235,0.35)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
                {createLoading ? "Adding..." : "Add user"}
              </button>
              {(createError || createSuccess) && (
                <p
                  className={`md:col-span-4 text-sm ${
                    createError ? "text-rose-300" : "text-emerald-300"
                  }`}
                >
                  {createError || createSuccess}
                </p>
              )}
            </form>
          )}
          <div className="mt-7 flex flex-col gap-6">
            <div>
              <div className="relative flex items-center">
                <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-5 h-7 w-7 text-slate-400" fill="none" aria-hidden="true">
                  <path d="m21 21-4.4-4.4M10.8 18.1a7.3 7.3 0 1 1 0-14.6 7.3 7.3 0 0 1 0 14.6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tracked users..."
                  className="h-[64px] w-full rounded-lg border border-slate-700/70 bg-slate-950/35 pl-16 pr-5 text-[18px] text-slate-100 placeholder:text-slate-400 shadow-inner shadow-slate-950/25 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/45"
                />
                {searchLoading && <span className="absolute right-5 text-sm text-slate-400">Searching...</span>}
              </div>
              <div className="mt-6 max-h-72 overflow-y-auto">
                <SearchResults
                  results={results}
                  selectedId={selectedUser?.tg_user_id}
                  onSelect={(user) => setSelectedUser(user)}
                />
              </div>
            </div>
            <div>
              {selectedUser ? (
                <UserSummary user={selectedUser} />
              ) : (
                <div className="flex min-h-[270px] flex-col items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/35 px-6 py-12 text-center shadow-inner shadow-slate-950/20">
                  <div className="mb-6 flex h-[84px] w-[84px] items-center justify-center rounded-full border border-slate-700/60 bg-slate-800/50 text-slate-400 shadow-[0_0_34px_rgba(37,99,235,0.12)]">
                    <UsersGlyph className="h-10 w-10" />
                  </div>
                  <p className="text-[18px] font-medium text-slate-300">
                    Start typing a username or ID to find tracked users.
                  </p>
                  <p className="mt-6 max-w-[480px] text-[16px] leading-[1.45] text-slate-400">
                    Select a tracked user to inspect heatmaps, aggregated activity,
                    <br className="hidden sm:block" />
                    and session export options.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {state.error && (
          <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-300">
            {state.error}
          </div>
        )}

        {selectedUser && !state.loadingData && (
          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 p-5 shadow-[0_18px_50px_rgba(2,8,23,0.22)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Weekly heatmap</h3>
                <span className="text-xs text-slate-400">minutes online</span>
              </div>
              <HeatmapChart data={summaryHeatmap} />
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 p-5 shadow-[0_18px_50px_rgba(2,8,23,0.22)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Hourly distribution</h3>
                <span className="text-xs text-slate-400">minutes online</span>
              </div>
              <HourlyDistributionChart data={summaryHourly} timezone={selectedUser.tz} />
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 p-5 shadow-[0_18px_50px_rgba(2,8,23,0.22)] md:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Daily trend</h3>
                <span className="text-xs text-slate-400">minutes online per day</span>
              </div>
              <TrendLineChart data={summaryHourly} />
            </div>
          </section>
        )}

        {selectedUser && (
          <section className="rounded-lg border border-slate-700/60 bg-slate-900/45 p-5 shadow-[0_18px_50px_rgba(2,8,23,0.22)]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Recent sessions</h3>
              <div className="flex gap-2 text-xs">
                <button
                  className="rounded-md border border-sky-400/45 bg-sky-500/10 px-4 py-2 text-sky-100 transition hover:bg-sky-500/20"
                  onClick={() => handleExport("csv")}
                >
                  Export CSV
                </button>
                <button
                  className="rounded-md border border-slate-700 bg-slate-800/70 px-4 py-2 text-slate-200 transition hover:bg-slate-700"
                  onClick={() => handleExport("json")}
                >
                  Export JSON
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Raw session intervals with closure reason. Offline accuracy depends on the Telegram privacy settings of
              the user.
            </p>
            <div className="mt-4">
              <SessionsTable sessions={state.sessions} now={now} />
            </div>
          </section>
        )}

        {state.loadingData && (
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 p-6 text-center text-sm text-slate-400">
            Loading activity data...
          </div>
        )}
          </>
        )}

        {activeTab === "Analytics" && (
          <AnalyticsView state={state} selectedUser={selectedUser} now={now} handleExport={handleExport} />
        )}

        {activeTab === "Chat Authors" && (
          <ChatAuthorsView token={token} isAdmin={user?.role === "admin"} />
        )}
      </div>
      </DashboardShell>
  );
}

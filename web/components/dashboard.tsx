"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  API_BASE_URL,
  createTrackedUser,
  getHeatmapData,
  getHourlyData,
  getRecentSessions,
  getTrackedUser,
  searchTrackedUsers,
  type Heatmap,
  type Session,
  type TrackedUser
} from "@/lib/api";
import LoginGate from "./login-gate";
import SearchResults from "./search-results";
import UserSummary from "./user-summary";
import HeatmapChart from "./charts/HeatmapChart";
import HourlyDistributionChart from "./charts/HourlyDistributionChart";
import TrendLineChart from "./charts/TrendLineChart";
import SessionsTable from "./sessions-table";
import { useAuthStore } from "@/store/use-auth";

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

function AnalyticsView() {
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
              <option>oral</option>
              <option>@ogater</option>
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
        
        <button className="h-10 rounded-md bg-[#0ea5e9] px-6 text-[14px] font-medium text-white shadow-[0_0_20px_rgba(14,165,233,0.3)] transition hover:bg-[#0284c7]">
          Export report
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Online today", value: "2h 18m" },
          { label: "Sessions", value: "12" },
          { label: "Active window", value: "19:00–22:00" },
          { label: "Data coverage", value: "92%" }
        ].map((metric) => (
          <div key={metric.label} className="rounded-md border border-slate-700/50 bg-slate-900/30 p-4">
            <div className="text-[13px] text-slate-400">{metric.label}</div>
            <div className="mt-1 text-[20px] font-medium text-white">{metric.value}</div>
          </div>

        ))}
      </div>

      <div className="rounded-md border border-slate-700/50 bg-slate-900/30 p-5">
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
                const isBlue = hour >= 14 && hour <= 21;
                const intensity = isBlue ? [20, 40, 60, 80, 100, 80, 60, 40][hour - 14] : 0;
                
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

      <div className="rounded-md border border-slate-700/50 bg-slate-900/30 p-5">
        <h3 className="text-[14px] font-semibold text-white">Session timeline</h3>
        <div className="mt-4">
          <div className="relative h-2 w-full rounded-full bg-slate-800/80">
            <div className="absolute left-[15%] h-full w-[5%] rounded-full bg-[#0ea5e9]"></div>
            <div className="absolute left-[30%] h-full w-[10%] rounded-full bg-[#0ea5e9]"></div>
            <div className="absolute left-[55%] h-full w-[8%] rounded-full bg-[#0ea5e9]"></div>
            <div className="absolute left-[75%] h-full w-[12%] rounded-full bg-[#0ea5e9]"></div>
            <div className="absolute left-[95%] h-full w-[3%] rounded-full bg-[#0ea5e9]"></div>
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

      <div className="rounded-md border border-slate-700/50 bg-slate-900/30 p-0">
        <div className="p-5 pb-3">
          <h3 className="text-[14px] font-semibold text-white">Recent sessions</h3>
        </div>
        <table className="w-full text-left text-[13px]">
          <thead className="border-y border-slate-700/50 bg-slate-900/50 text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Date <span className="text-[10px]">▼</span></th>
              <th className="px-5 py-3 font-medium">Online</th>
              <th className="px-5 py-3 font-medium">Offline</th>
              <th className="px-5 py-3 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50 text-slate-300">
            {[
              { date: "May 10, 2026", on: "19:03", off: "21:21", dur: "2h 18m" },
              { date: "May 9, 2026", on: "18:42", off: "20:37", dur: "1h 55m" },
              { date: "May 8, 2026", on: "20:11", off: "22:03", dur: "1h 52m" },
              { date: "May 7, 2026", on: "19:27", off: "21:05", dur: "1h 38m" },
              { date: "May 6, 2026", on: "18:56", off: "20:44", dur: "1h 48m" },
            ].map((row, i) => (
              <tr key={i}>
                <td className="px-5 py-3">{row.date}</td>
                <td className="px-5 py-3">{row.on}</td>
                <td className="px-5 py-3">{row.off}</td>
                <td className="px-5 py-3">{row.dur}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { token, user, logout } = useAuthStore((state) => ({
    token: state.token,
    user: state.user,
    logout: state.logout
  }));
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
    <LoginGate>
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
          {user && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex h-[78px] items-center gap-4 rounded-lg border border-slate-700/70 bg-slate-900/70 px-5 pr-7 shadow-[0_18px_55px_rgba(2,8,23,0.22)] backdrop-blur">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-700 shadow-[0_0_28px_rgba(37,99,235,0.45)]">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
                    <path
                      d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5.2 20a6.8 6.8 0 0 1 13.6 0"
                      fill="white"
                    />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block max-w-[230px] truncate text-[17px] font-medium leading-6 text-white">
                    {user.email}
                  </span>
                  <span className="block text-sm text-slate-400">{user.role}</span>
                </span>
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-400" fill="none" aria-hidden="true">
                  <path d="m7 9 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <button
                className="flex h-[78px] items-center justify-center gap-3 rounded-lg border border-slate-700/70 bg-slate-900/70 px-7 text-[16px] font-semibold text-white shadow-[0_18px_55px_rgba(2,8,23,0.22)] transition hover:border-sky-400/50 hover:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                onClick={logout}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-300" fill="none" aria-hidden="true">
                  <path d="M14 8V6.5A2.5 2.5 0 0 0 11.5 4h-5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h5a2.5 2.5 0 0 0 2.5-2.5V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M10 12h9m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Sign out
              </button>
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
          <AnalyticsView />
        )}
      </div>
      </DashboardShell>
    </LoginGate>
  );
}

"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function SidebarIcon({ children }: { children: React.ReactNode }) {
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

function DashboardShell({ children }: { children: React.ReactNode }) {
  const navItems = [
    {
      label: "Tracked Users",
      active: true,
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path d="M8 7h8M8 12h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="5" y="3.5" width="14" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    },
    {
      label: "Analytics",
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path d="M6 18V13M12 18V6M18 18v-9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M6 20h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )
    },
    {
      label: "Export",
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
                className={`group flex flex-col items-center gap-1.5 px-2 py-4 text-center text-[15px] font-medium ${
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
      <div className="mx-auto min-h-screen w-full max-w-[1510px] px-5 py-8 sm:px-8 lg:pl-[180px] lg:pr-8 xl:pl-[180px] xl:pr-12">
        {children}
      </div>
    </div>
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

export default function Dashboard() {
  const { token, user, logout } = useAuthStore((state) => ({
    token: state.token,
    user: state.user,
    logout: state.logout
  }));
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
    consent_basis: "oral",
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
    const tgUserId = Number(createForm.tg_user_id);
    if (!Number.isInteger(tgUserId) || tgUserId <= 0) {
      setCreateError("Telegram ID must be a positive number.");
      setCreateSuccess(null);
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const created = await createTrackedUser(token, {
        tg_user_id: tgUserId,
        username: createForm.username.trim() || undefined,
        display_name: createForm.display_name.trim() || undefined,
        consent_basis: createForm.consent_basis.trim() || "oral",
        tz: createForm.tz.trim() || "Europe/Kyiv"
      });
      setSelectedUser(created);
      setResults((prev) => {
        const withoutDuplicate = prev.filter((item) => item.tg_user_id !== created.tg_user_id);
        return [created, ...withoutDuplicate];
      });
      setSearch(String(created.tg_user_id));
      setCreateForm({
        tg_user_id: "",
        username: "",
        display_name: "",
        consent_basis: "oral",
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
      <DashboardShell>
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

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-medium text-slate-100">Tracked users</h2>
          <p className="mt-1 text-sm text-slate-400">
            Search by username, display name, or Telegram ID. Only users with explicit consent are visible.
          </p>
          {user?.role === "admin" && (
            <form
              className="mt-5 grid gap-3 rounded-md border border-slate-800 bg-slate-950 p-4 md:grid-cols-5"
              onSubmit={handleCreateTracked}
            >
              <input
                type="number"
                min="1"
                value={createForm.tg_user_id}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, tg_user_id: event.target.value }))
                }
                placeholder="Telegram ID"
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                required
              />
              <input
                type="text"
                value={createForm.username}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="Username"
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
              <input
                type="text"
                value={createForm.display_name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, display_name: event.target.value }))
                }
                placeholder="Display name"
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
              <input
                type="text"
                value={createForm.consent_basis}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, consent_basis: event.target.value }))
                }
                placeholder="Consent basis"
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
              <button
                type="submit"
                disabled={createLoading}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {createLoading ? "Adding..." : "Add user"}
              </button>
              {(createError || createSuccess) && (
                <p
                  className={`md:col-span-5 text-sm ${
                    createError ? "text-rose-300" : "text-emerald-300"
                  }`}
                >
                  {createError || createSuccess}
                </p>
              )}
            </form>
          )}
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start">
            <div className="w-full md:w-1/2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search tracked users..."
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
                {searchLoading && <span className="text-xs text-slate-400">Searching...</span>}
              </div>
              <div className="mt-3 max-h-72 overflow-y-auto">
                <SearchResults
                  results={results}
                  selectedId={selectedUser?.tg_user_id}
                  onSelect={(user) => setSelectedUser(user)}
                />
              </div>
            </div>
            <div className="w-full md:w-1/2">
              {selectedUser ? (
                <UserSummary user={selectedUser} />
              ) : (
                <div className="rounded-lg border border-dashed border-slate-700 p-6 text-sm text-slate-400">
                  Select a tracked user to inspect heatmaps, aggregated activity, and session export options.
                </div>
              )}
            </div>
          </div>
        </section>

        {state.error && (
          <div className="rounded border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
            {state.error}
          </div>
        )}

        {selectedUser && !state.loadingData && (
          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-100">Weekly heatmap</h3>
                <span className="text-xs text-slate-500">minutes online</span>
              </div>
              <HeatmapChart data={summaryHeatmap} />
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-100">Hourly distribution</h3>
                <span className="text-xs text-slate-500">minutes online</span>
              </div>
              <HourlyDistributionChart data={summaryHourly} timezone={selectedUser.tz} />
            </div>
            <div className="md:col-span-2 rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-100">Daily trend</h3>
                <span className="text-xs text-slate-500">minutes online per day</span>
              </div>
              <TrendLineChart data={summaryHourly} />
            </div>
          </section>
        )}

        {selectedUser && (
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100">Recent sessions</h3>
              <div className="flex gap-2 text-xs">
                <button
                  className="rounded border border-sky-500/50 bg-sky-500/10 px-3 py-1 text-sky-200 hover:bg-sky-500/20"
                  onClick={() => handleExport("csv")}
                >
                  Export CSV
                </button>
                <button
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-slate-200 hover:bg-slate-700"
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
          <div className="rounded border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400">
            Loading activity data...
          </div>
        )}
      </div>
      </DashboardShell>
    </LoginGate>
  );
}

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
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-200 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Telegram activity dashboard</h1>
            <p className="text-sm text-slate-400">
              Inspect online/offline sessions, consent metadata, aggregated heatmaps, and export evidence.
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <span className="rounded border border-slate-700 bg-slate-800 px-2 py-1">
                {user.email} · {user.role}
              </span>
              <button
                className="rounded border border-transparent bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700"
                onClick={logout}
              >
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
    </LoginGate>
  );
}

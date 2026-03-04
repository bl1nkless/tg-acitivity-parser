export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type Role = "admin" | "viewer";

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserInfo {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface TrackedUser {
  tg_user_id: number;
  username?: string | null;
  display_name?: string | null;
  phone_e164?: string | null;

  consent_at: string;
  tz: string;
  track_enabled: boolean;
  added_at: string;
  notes?: string | null;
  consent_reference?: string | null;
}

export interface TrackedUserCreate {
  tg_user_id?: number;
  username?: string;
  display_name?: string;

  tz?: string;
}

export interface Session {
  id: number;
  tg_user_id: number;
  ts_from: string;
  ts_to?: string | null;
  source_precision: "exact" | "approx";
  closed_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HeatmapCell {
  weekday: number;
  hour: number;
  online_seconds: number;
}

export interface Heatmap {
  tg_user_id: number;
  cells: HeatmapCell[];
}

export interface TelegramChat {
  telegram_chat_id: number;
  access_hash?: number | null;
  username?: string | null;
  title?: string | null;
  chat_type: string;
}

export type ChatAuthorJobStatus =
  | "queued"
  | "running"
  | "paused_flood_wait"
  | "completed"
  | "failed"
  | "cancelled";

export interface ChatAuthorJob {
  id: string;
  telegram_chat_id: number;
  lookback_days: number;
  period_start: string;
  period_end: string;
  status: ChatAuthorJobStatus;
  cursor_message_id?: number | null;
  cursor_message_date?: string | null;
  scanned_messages_count: number;
  unique_authors_count: number;
  flood_wait_until?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  updated_at: string;
}

export interface ChatActiveAuthor {
  telegram_chat_id: number;
  telegram_user_id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_bot?: boolean | null;
  message_count: number;
  first_message_at: string;
  last_message_at: string;
}

export interface ChatActiveAuthorsResponse extends Paginated<ChatActiveAuthor> {
  period_start?: string | null;
  period_end?: string | null;
  latest_job?: ChatAuthorJob | null;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const mergedHeaders = new Headers(options.headers ?? {});
  if (!mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }
  if (token) {
    mergedHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: mergedHeaders
  });
  if (!response.ok) {
    const text = await response.text();
    let apiMessage: string | null = null;
    try {
      const parsed = JSON.parse(text) as { detail?: unknown };
      if (typeof parsed.detail === "string") {
        apiMessage = parsed.detail;
      }
    } catch {
      // Fall back to the raw response body below when the API does not return JSON.
    }
    if (apiMessage) {
      throw new Error(apiMessage);
    }
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.append("username", email);
  body.append("password", password);
  const response = await fetch(`${API_BASE_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!response.ok) {
    throw new Error("Invalid credentials");
  }
  return (await response.json()) as TokenResponse;
}

export async function getCurrentUser(token: string): Promise<UserInfo> {
  return await request<UserInfo>("/auth/me", {}, token);
}

export async function searchTrackedUsers(
  token: string,
  search: string,
  limit = 10
): Promise<Paginated<TrackedUser>> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", "0");
  if (search) {
    params.set("search", search.replace(/^@+/, ""));
  }
  return await request<Paginated<TrackedUser>>(`/tracked?${params.toString()}`, {}, token);
}

export async function createTrackedUser(
  token: string,
  payload: TrackedUserCreate
): Promise<TrackedUser> {
  return await request<TrackedUser>(
    "/tracked/",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export async function getTrackedUser(token: string, userId: number): Promise<TrackedUser> {
  return await request<TrackedUser>(`/tracked/${userId}`, {}, token);
}

export async function getHeatmapData(
  token: string,
  userId: number,
  since?: string,
  until?: string
): Promise<Heatmap> {
  const params = new URLSearchParams();
  if (since) params.set("since", since);
  if (until) params.set("until", until);
  const postfix = params.toString() ? `?${params.toString()}` : "";
  return await request<Heatmap>(`/users/${userId}/agg/heatmap${postfix}`, {}, token);
}

export async function getHourlyData(
  token: string,
  userId: number,
  since?: string,
  until?: string
): Promise<Array<{ bucket_start: string; online_seconds: number }>> {
  const params = new URLSearchParams();
  if (since) params.set("since", since);
  if (until) params.set("until", until);
  const postfix = params.toString() ? `?${params.toString()}` : "";
  return await request<Array<{ bucket_start: string; online_seconds: number }>>(
    `/users/${userId}/agg/hourly${postfix}`,
    {},
    token
  );
}

export async function getRecentSessions(
  token: string,
  userId: number,
  limit = 10
): Promise<Paginated<Session>> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", "0");
  return await request<Paginated<Session>>(`/users/${userId}/sessions?${params.toString()}`, {}, token);
}

export async function resolveTelegramChat(token: string, chatRef: string): Promise<TelegramChat> {
  return await request<TelegramChat>(
    "/telegram/chats/resolve",
    {
      method: "POST",
      body: JSON.stringify({ chat_ref: chatRef })
    },
    token
  );
}

export async function createChatAuthorJob(
  token: string,
  telegramChatId: number,
  lookbackDays: number
): Promise<ChatAuthorJob> {
  return await request<ChatAuthorJob>(
    "/telegram/chat-author-jobs",
    {
      method: "POST",
      body: JSON.stringify({ telegram_chat_id: telegramChatId, lookback_days: lookbackDays })
    },
    token
  );
}

export async function getChatAuthorJob(token: string, jobId: string): Promise<ChatAuthorJob> {
  return await request<ChatAuthorJob>(`/telegram/chat-author-jobs/${jobId}`, {}, token);
}

export async function getChatActiveAuthors(
  token: string,
  telegramChatId: number,
  periodDays: number,
  limit = 100,
  offset = 0,
  search?: string
): Promise<ChatActiveAuthorsResponse> {
  const params = new URLSearchParams();
  params.set("period_days", String(periodDays));
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (search) params.set("search", search);
  return await request<ChatActiveAuthorsResponse>(
    `/telegram/chats/${telegramChatId}/active-authors?${params.toString()}`,
    {},
    token
  );
}

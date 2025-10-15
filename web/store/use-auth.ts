import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getCurrentUser, login, TokenResponse, UserInfo } from "@/lib/api";

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loading: false,
      error: null,
      login: async (email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const tokenResponse: TokenResponse = await login(email, password);
          const token = tokenResponse.access_token;
          const user = await getCurrentUser(token);
          set({ token, user, loading: false, error: null });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Unable to login";
          set({ error: message, loading: false, token: null, user: null });
          throw error;
        }
      },
      logout: () => set({ token: null, user: null }),
      hydrate: async () => {
        const token = get().token;
        if (!token) return;
        try {
          const user = await getCurrentUser(token);
          set({ user });
        } catch {
          set({ token: null, user: null });
        }
      }
    }),
    {
      name: "spec1-auth"
    }
  )
);

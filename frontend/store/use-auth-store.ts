import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: number;
  email: string;
  full_name?: string;
  avatar_url?: string | null;
  is_active?: boolean;
  is_global_admin?: boolean;
  notification_in_app_enabled?: boolean;
  notification_email_enabled?: boolean;
  notify_task_assignments?: boolean;
  notify_mentions?: boolean;
  notify_calendar?: boolean;
  notify_due_dates?: boolean;
  notify_ai_risk?: boolean;
  role?: string;
}

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  user: User | null;

  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isAuthenticated: false,
      user: null,

      setAuth: (token: string, user: User) => {
        set({
          token,
          user,
          isAuthenticated: true,
        });
      },

      setUser: (user: User) => {
        set({ user });
      },

      // păstrăm setToken temporar pentru compatibilitate cu codul existent
      setToken: (token: string) => {
        set({
          token,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          token: null,
          isAuthenticated: false,
          user: null,
        });
      },
    }),
    {
      name: "auth-storage",
    }
  )
);

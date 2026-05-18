import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: number;
  email: string;
  full_name?: string;
  avatar_url?: string | null;
  is_active?: boolean;
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

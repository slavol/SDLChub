import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jwtDecode } from "jwt-decode"; // Asigură-te că ai instalat asta

interface User {
  id: number;
  email: string;
  full_name?: string; // Optional, il vom popula mai tarziu din backend sau token
  role?: string;
}

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  user: User | null; // <--- Am adăugat asta pentru a repara eroarea
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isAuthenticated: false,
      user: null,

      setToken: (token: string) => {
        try {
          // Decodăm token-ul pentru a extrage ID-ul și Email-ul
          const decoded: any = jwtDecode(token);
          
          set({ 
            token, 
            isAuthenticated: true,
            user: {
                id: decoded.id,
                email: decoded.sub,
                // Momentan backend-ul nu pune full_name in token, 
                // deci punem email-ul ca fallback sau un string generic
                full_name: decoded.sub?.split('@')[0] || "User" 
            }
          });
        } catch (error) {
          console.error("Invalid token:", error);
          set({ token: null, isAuthenticated: false, user: null });
        }
      },

      logout: () => set({ token: null, isAuthenticated: false, user: null }),
    }),
    {
      name: "auth-storage",
    }
  )
);
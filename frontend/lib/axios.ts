import axios from "axios";
import { useAuthStore } from "@/store/use-auth-store";
import { getPostLogoutRedirect } from "@/lib/logout-redirect";

// Creăm instanța Axios
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

// --- 1. REQUEST INTERCEPTOR (Injectează Token-ul) ---
api.interceptors.request.use(
  (config) => {
    // Accesăm token-ul direct din starea globală (Zustand)
    const token = useAuthStore.getState().token;
    
    // Dacă avem token, îl punem în header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- 2. RESPONSE INTERCEPTOR (Gestionează Erorile 401) ---
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Dacă primim 401 (Unauthorized), înseamnă că token-ul a expirat sau e invalid
    const requestUrl = String(error.config?.url || "");
    const isAuthRequest = requestUrl.includes("/auth/login") || requestUrl.includes("/auth/register");

    if (error.response?.status === 401 && !isAuthRequest) {
      console.warn("Token expired or unauthorized. Logging out...");
      
      // Delogăm utilizatorul automat
      useAuthStore.getState().logout();
      
      // Opțional: Redirecționăm către login dacă suntem în browser
      if (typeof window !== "undefined") {
         window.location.href = getPostLogoutRedirect() || "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

import axios from "axios";

// URL-ul backend-ului FastAPI
const API_URL = "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor: Adaugă automat token-ul din localStorage la fiecare cerere
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor: Gestionare erori (ex: Token expirat -> Logout)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Dacă primim 401 Unauthorized, ștergem tokenul (opțional redirect la login)
      localStorage.removeItem("token");
      // Putem forța redirectul aici dacă e cazul:
      // window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
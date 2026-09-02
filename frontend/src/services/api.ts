import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 120000,
});

let refreshPromise: Promise<boolean> | null = null;
let isRefreshing = false;
let loggedOut = false;

window.addEventListener("auth:expired", () => {
  loggedOut = true;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response) return Promise.reject(error);
    if (loggedOut) return Promise.reject(error);

    const originalRequest = error.config;
    if (error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) return Promise.reject(error);
      isRefreshing = true;
      originalRequest._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = api.post("/usuarios/refresh-token").then(() => true).catch(() => false);
        }
        const ok = await refreshPromise;
        refreshPromise = null;
        if (ok) {
          return api(originalRequest);
        }
      } finally {
        isRefreshing = false;
      }
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(error);
  }
);

export function resetAuthState() {
  loggedOut = false;
}

export default api;

import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

const api = axios.create({
  baseURL,
  withCredentials: true,
});

let refreshPromise: Promise<boolean> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response) {
      console.warn("API no disponible (servidor apagado)");
      return Promise.reject(error);
    }
    const originalRequest = error.config;
    if (error.response.status === 401 && !originalRequest._retry && originalRequest.url !== "/usuarios/refresh-token") {
      originalRequest._retry = true;
      if (!refreshPromise) {
        refreshPromise = api.post("/usuarios/refresh-token").then(() => true).catch(() => false);
      }
      const ok = await refreshPromise;
      refreshPromise = null;
      if (ok) {
        return api(originalRequest);
      }
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(error);
  }
);

export default api;

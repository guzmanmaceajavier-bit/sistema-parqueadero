import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

let token = localStorage.getItem("token");

api.interceptors.request.use((config) => {
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const setToken = (t) => {
  token = t;
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
};

let refreshPromise = null;

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
        refreshPromise = api.post("/usuarios/refresh-token").then((res) => {
          if (res.data?.token) setToken(res.data.token);
          return true;
        }).catch(() => false);
      }
      const ok = await refreshPromise;
      refreshPromise = null;
      if (ok) {
        return api(originalRequest);
      }
      setToken(null);
      window.dispatchEvent(new Event("auth:expired"));
    }
    return Promise.reject(error);
  }
);

export default api;

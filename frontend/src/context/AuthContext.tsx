import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const loginadoRef = useRef(false);

  useEffect(() => {
    const onAuthExpired = () => {
      setUser(null);
      setLoading(false);
      loginadoRef.current = false;
    };
    window.addEventListener("auth:expired", onAuthExpired);

    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return () => window.removeEventListener("auth:expired", onAuthExpired);
    }

    api.get("/usuarios/perfil")
      .then((res) => {
        if (loginadoRef.current) return;
        setUser(res.data?.usuario || null);
      })
      .catch(() => {
        if (loginadoRef.current) return;
        setUser(null);
      })
      .finally(() => {
        if (loginadoRef.current) return;
        setLoading(false);
      });

    return () => window.removeEventListener("auth:expired", onAuthExpired);
  }, []);

  const login = useCallback((userData) => {
    loginadoRef.current = true;
    setUser(userData);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    loginadoRef.current = false;
    try { await api.post("/usuarios/logout"); } catch {}
    setUser(null);
  }, []);

  const isAuthenticated = !!user;
  const isAdmin = user?.rol === "admin";
  const isSupervisor = user?.rol === "supervisor";
  const isEmpleado = user?.rol === "empleado";

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, isAdmin, isSupervisor, isEmpleado, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
};

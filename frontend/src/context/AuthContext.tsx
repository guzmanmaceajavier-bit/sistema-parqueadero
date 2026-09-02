import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import api from "../services/api";

interface User {
  id: number;
  nombre: string;
  usuario: string;
  correo: string;
  rol: string;
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isEmpleado: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const loginadoRef = useRef(false);

  useEffect(() => {
    const onAuthExpired = () => {
      setUser(null);
      setLoading(false);
      loginadoRef.current = false;
    };
    window.addEventListener("auth:expired", onAuthExpired);

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

  const login = useCallback((userData: User) => {
    loginadoRef.current = true;
    setUser(userData);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    loginadoRef.current = false;
    try { await api.post("/usuarios/logout"); } catch { /* ignore */ }
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

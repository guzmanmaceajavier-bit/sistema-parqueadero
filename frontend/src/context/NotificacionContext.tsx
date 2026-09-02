import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import api from "../services/api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

interface Notificacion {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
  enlace?: string;
  esAlerta?: boolean;
}

interface NotificacionContextType {
  notificaciones: Notificacion[];
  noLeidas: number;
  conectado: boolean;
  marcarLeidas: () => void;
  limpiarNotificaciones: () => void;
  agregarNotificacion: (n: Partial<Notificacion>) => void;
}

const NotificacionContext = createContext<NotificacionContextType | null>(null);

export function useNotificaciones() {
  return useContext(NotificacionContext);
}

export function NotificacionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [conectado, setConectado] = useState(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const agregarNotificacion = useCallback((notif: Partial<Notificacion>) => {
    const n: Notificacion = { id: Date.now() + Math.random(), leida: false, fecha: new Date().toISOString(), tipo: "sistema", titulo: "", mensaje: "", ...notif };
    setNotificaciones(prev => [n, ...prev].slice(0, 50));
  }, []);

  const cargarAlertas = useCallback(async () => {
    try {
      const res = await api.get("/alertas");
      const alertas = res.data.alertas || [];
      setNotificaciones(prev => {
        const socketNotifs = prev.filter(n => !n.esAlerta);
        const alertasNotifs: Notificacion[] = alertas.map((a: Record<string, unknown>, i: number) => ({
          id: Date.now() + i + 0.5,
          tipo: "alerta",
          titulo: a.titulo as string,
          mensaje: a.descripcion as string,
          fecha: new Date().toISOString(),
          leida: false,
          enlace: a.enlace as string,
          esAlerta: true,
        }));
        return [...alertasNotifs, ...socketNotifs].slice(0, 50);
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    const s = io(SOCKET_URL, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
      timeout: 5000,
    });
    socketRef.current = s;

    s.on("connect", () => { setConectado(true); s.emit("join"); cargarAlertas(); });
    s.on("disconnect", () => setConectado(false));

    s.on("ingreso:entrada", (data: { mensaje?: string }) => agregarNotificacion({ tipo: "entrada", titulo: "Entrada de vehículo", mensaje: data.mensaje || "" }));
    s.on("ingreso:salida", (data: { mensaje?: string }) => agregarNotificacion({ tipo: "salida", titulo: "Salida de vehículo", mensaje: data.mensaje || "" }));
    s.on("caja:abierta", (data: { mensaje?: string }) => agregarNotificacion({ tipo: "caja", titulo: "Caja abierta", mensaje: data.mensaje || "" }));
    s.on("caja:cerrada", (data: { mensaje?: string }) => agregarNotificacion({ tipo: "caja", titulo: "Caja cerrada", mensaje: data.mensaje || "" }));

    return () => { s.disconnect(); socketRef.current = null; };
  }, [user, agregarNotificacion, cargarAlertas]);

  useEffect(() => {
    if (!user) return;
    cargarAlertas();
    const iv = setInterval(cargarAlertas, 60000);
    return () => clearInterval(iv);
  }, [user, cargarAlertas]);

  const marcarLeidas = useCallback(() => {
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
  }, []);

  const limpiarNotificaciones = useCallback(() => {
    setNotificaciones([]);
  }, []);

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  return (
    <NotificacionContext.Provider value={{ notificaciones, noLeidas, conectado, marcarLeidas, limpiarNotificaciones, agregarNotificacion }}>
      {children}
    </NotificacionContext.Provider>
  );
}

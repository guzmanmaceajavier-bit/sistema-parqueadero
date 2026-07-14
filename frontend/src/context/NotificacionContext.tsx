import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

const NotificacionContext = createContext();

export function useNotificaciones() {
  return useContext(NotificacionContext);
}

export function NotificacionProvider({ children }) {
  const { user } = useAuth();
  const [notificaciones, setNotificaciones] = useState([]);
  const [conectado, setConectado] = useState(false);
  const socketRef = useRef(null);

  const agregarNotificacion = useCallback((notif) => {
    const n = { id: Date.now() + Math.random(), leida: false, fecha: new Date().toISOString(), ...notif };
    setNotificaciones(prev => [n, ...prev].slice(0, 50));
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

    s.on("connect", () => { setConectado(true); s.emit("join"); });
    s.on("disconnect", () => setConectado(false));

    s.on("ingreso:entrada", (data) => agregarNotificacion({ tipo: "entrada", titulo: "Entrada de vehículo", mensaje: data.mensaje, data }));
    s.on("ingreso:salida", (data) => agregarNotificacion({ tipo: "salida", titulo: "Salida de vehículo", mensaje: data.mensaje, data }));
    s.on("caja:abierta", (data) => agregarNotificacion({ tipo: "caja", titulo: "Caja abierta", mensaje: data.mensaje, data }));
    s.on("caja:cerrada", (data) => agregarNotificacion({ tipo: "caja", titulo: "Caja cerrada", mensaje: data.mensaje, data }));

    return () => { s.disconnect(); socketRef.current = null; };
  }, [user, agregarNotificacion]);

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

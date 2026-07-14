import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";
import CajaAbrirModal from "../components/CajaAbrirModal";
import { io } from "socket.io-client";

const CajaContext = createContext(null);

export function CajaProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [cajaAbierta, setCajaAbierta] = useState(null);
  const [cajaAuthorized, setCajaAuthorized] = useState(false);
  const [cajaPassword, setCajaPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Password modal state (lazy open from other pages)
  const [pwOpen, setPwOpen] = useState(false);
  const [pwResolve, setPwResolve] = useState(null);

  const cargarCajaActiva = useCallback(async () => {
    if (!isAuthenticated) { setCajaAbierta(null); return; }
    try {
      const res = await api.get("/caja/actual");
      setCajaAbierta(res.data.caja);
    } catch { setCajaAbierta(null); }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) cargarCajaActiva();
    else { setCajaAbierta(null); setCajaAuthorized(false); setCajaPassword(""); }
  }, [isAuthenticated, cargarCajaActiva]);

  // Socket listeners
  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = io(import.meta.env.VITE_API_URL || "", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socket.on("caja:abierta", cargarCajaActiva);
    socket.on("caja:cerrada", cargarCajaActiva);
    socket.on("caja:movimiento-eliminado", cargarCajaActiva);
    socket.on("caja:movimiento-actualizado", cargarCajaActiva);
    return () => { socket.disconnect(); };
  }, [isAuthenticated, cargarCajaActiva]);

  // Authorize: verify password once, store in memory for reuse
  const authorize = useCallback(async (password) => {
    await api.post("/usuarios/verificar-password", { password });
    setCajaPassword(password);
    setCajaAuthorized(true);
  }, []);

  // Direct open with password + optional apertura
  const abrirCaja = useCallback(async (datos) => {
    setLoading(true);
    try {
      const res = await api.post("/caja/abrir", datos);
      setCajaAbierta(res.data.caja);
      setCajaAuthorized(true);
      return res.data.caja;
    } finally { setLoading(false); }
  }, []);

  // Re-open using stored password (Caja page "Abrir Caja" button)
  const reabrirCaja = useCallback(async () => {
    if (!cajaPassword) throw new Error("No hay contraseña almacenada");
    setLoading(true);
    try {
      const res = await api.post("/caja/abrir", { apertura: 0, password: cajaPassword });
      setCajaAbierta(res.data.caja);
      return res.data.caja;
    } finally { setLoading(false); }
  }, [cajaPassword]);

  // Cerrar caja
  const cerrarCaja = useCallback(async (id, datos) => {
    setLoading(true);
    try {
      const res = await api.put(`/caja/cerrar/${id}`, datos);
      setCajaAbierta(null);
      return res.data;
    } finally { setLoading(false); }
  }, []);

  const refrescarCaja = useCallback(() => cargarCajaActiva(), [cargarCajaActiva]);

  // Lazy open: used by Ingresos/Mensualidades/Gastos when they get "Caja cerrada"
  const requestAbrirCaja = useCallback(() => {
    return new Promise((resolve) => {
      setPwResolve(() => resolve);
      setPwOpen(true);
    });
  }, []);

  const handlePwResult = useCallback((result) => {
    pwResolve?.(result);
    setPwOpen(false);
    setPwResolve(null);
  }, [pwResolve]);

  return (
    <CajaContext.Provider value={{
      cajaAbierta, setCajaAbierta, loading,
      cajaAuthorized, setCajaAuthorized,
      cajaPassword, setCajaPassword,
      authorize, abrirCaja, reabrirCaja,
      cerrarCaja, cargarCajaActiva, refrescarCaja,
      requestAbrirCaja,
    }}>
      {children}
      <CajaAbrirModal open={pwOpen} onDone={handlePwResult} abrirCaja={abrirCaja} />
    </CajaContext.Provider>
  );
}

export function useCaja() {
  const ctx = useContext(CajaContext);
  if (!ctx) throw new Error("useCaja must be used within CajaProvider");
  return ctx;
}

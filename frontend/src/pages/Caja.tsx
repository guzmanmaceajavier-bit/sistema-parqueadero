import { useEffect, useState, useCallback } from "react";
import { X, Lock, AlertTriangle, PenSquare, Trash2, Eye, Wallet } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { useCaja } from "../context/CajaContext";
import { useConfig } from "../context/ConfigContext";
import { formatCurrency, getMetodosPagoActivos } from "../utils/formatters";
import Toast from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination from "../components/Pagination";
import ScrollLock from "../components/ScrollLock";
import ExportButton from "../components/ExportButton";
import SelectWithOther from "../components/SelectWithOther";
import Select from "../components/ui/Select";

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";

function IconX() {
  return <X className="w-5 h-5" />;
}

function CajaEstadoBadge({ estado }) {
  const isOpen = estado === "ABIERTA";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${isOpen ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-emerald-500" : "bg-slate-400"}`} />
      {isOpen ? "Abierta" : "Cerrada"}
    </span>
  );
}

const formatValor = (v) => formatCurrency(v);

const metodoPagoLabel = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };
const metodoPagoBadge = { efectivo: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400", tarjeta: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400", transferencia: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400" };

export default function Caja() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { config } = useConfig();
  const { cajaAbierta, setCajaAbierta, refrescarCaja, cajaAuthorized, setCajaAuthorized, cajaPassword, setCajaPassword, authorize, abrirCaja, reabrirCaja, loading } = useCaja();

  const [cajas, setCajas] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [cargando, setCargando] = useState(false);
  const [eliminarId, setEliminarId] = useState(null);

  const [mostrarCerrar, setMostrarCerrar] = useState(false);
  const [mostrarEditar, setMostrarEditar] = useState(false);
  const [mostrarDetalle, setMostrarDetalle] = useState(null);
  const [cajaSel, setCajaSel] = useState(null);

  const [historialOpen, setHistorialOpen] = useState(false);
  const [historialSearch, setHistorialSearch] = useState("");

  const [formCerrar, setFormCerrar] = useState({ observacion: "" });
  const [conteo, setConteo] = useState({
    billetes: { "100000": 0, "50000": 0, "20000": 0, "10000": 0, "5000": 0, "2000": 0, "1000": 0 },
    monedas: { "1000": 0, "500": 0, "200": 0, "100": 0, "50": 0 },
  });
  const [totalConteoCalculado, setTotalConteoCalculado] = useState(0);
  const [mostrarInfoArqueo, setMostrarInfoArqueo] = useState(false);
  const [formEditar, setFormEditar] = useState({ apertura: "", observacion: "" });

  const [pwValue, setPwValue] = useState("");
  const [pwError, setPwError] = useState("");

  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const mostrarToast = useCallback((mensaje, tipo = "success") => setToast({ mensaje, tipo }), []);

  // Calculate total conteo
  useEffect(() => {
    let total = 0;
    if (conteo.billetes) {
      for (const [denom, count] of Object.entries(conteo.billetes)) {
        total += parseInt(denom) * (Number(count) || 0);
      }
    }
    if (conteo.monedas) {
      for (const [denom, count] of Object.entries(conteo.monedas)) {
        total += parseInt(denom) * (Number(count) || 0);
      }
    }
    setTotalConteoCalculado(total);
  }, [conteo]);

  /* ─── Movimientos de HOY (inline cuando caja abierta) ─── */
  const [movsHoy, setMovsHoy] = useState(null);
  const [resumenHoy, setResumenHoy] = useState(null);
  const [cargandoMovsHoy, setCargandoMovsHoy] = useState(false);
  const [filtroHoyTipo, setFiltroHoyTipo] = useState("");
  const [filtroHoyMetodo, setFiltroHoyMetodo] = useState("");
  const [pageHoy, setPageHoy] = useState(1);
  const [paginationHoy, setPaginationHoy] = useState({});

  const cargarMovsHoy = useCallback(async (p = 1) => {
    if (!cajaAbierta) { setMovsHoy(null); setResumenHoy(null); return; }
    setCargandoMovsHoy(true);
    try {
      const params = new URLSearchParams();
      if (filtroHoyTipo) params.set("tipo", filtroHoyTipo);
      if (filtroHoyMetodo) params.set("metodoPago", filtroHoyMetodo);
      params.set("page", p);
      params.set("limit", "15");
      const res = await api.get(`/caja/${cajaAbierta.id}/movimientos?${params}`);
      setMovsHoy(res.data.movimientos || []);
      setResumenHoy(res.data.resumen);
      setPaginationHoy(res.data.pagination || {});
    } catch { setMovsHoy(null); } finally { setCargandoMovsHoy(false); }
  }, [cajaAbierta, filtroHoyTipo, filtroHoyMetodo]);

  useEffect(() => { setPageHoy(1); cargarMovsHoy(1); }, [cajaAbierta?.id]);

  /* ─── Editar movimiento ─── */
  const [editMovimiento, setEditMovimiento] = useState(null);
  const [formEditMov, setFormEditMov] = useState({ concepto: "", monto: "", metodoPago: "" });

  const abrirEditMov = (m) => {
    setEditMovimiento(m);
    setFormEditMov({ concepto: m.concepto || "", monto: m.monto?.toString() || "", metodoPago: m.metodoPago || "efectivo" });
  };

  const guardarEditMov = async () => {
    if (!editMovimiento) return;
    try {
      await api.put(`/caja/movimiento/${editMovimiento.id}`, {
        concepto: formEditMov.concepto,
        monto: parseFloat(formEditMov.monto) || 0,
        metodoPago: formEditMov.metodoPago,
      });
      setEditMovimiento(null);
      mostrarToast("Movimiento actualizado");
      cargarMovsHoy(pageHoy);
    } catch (err) { mostrarToast(err.response?.data?.message || "Error al actualizar", "error"); }
  };

  const anularMovimiento = async (movId) => {
    if (!window.confirm("¿Anular este movimiento?")) return;
    try {
      await api.delete(`/caja/movimiento/${movId}`);
      mostrarToast("Movimiento anulado");
      if (mostrarDetalle) aplicarFiltros();
      cargarMovsHoy(pageHoy);
    } catch (err) { mostrarToast(err.response?.data?.message || "Error al anular", "error"); }
  };

  /* ─── Movimientos de detalle (modal para cajas cerradas) ─── */
  const [detalleCaja, setDetalleCaja] = useState(null);
  const [detalleMovs, setDetalleMovs] = useState(null);
  const [detalleResumen, setDetalleResumen] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroMetodo, setFiltroMetodo] = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");

  const verDetalle = async (caja, filtros) => {
    setMostrarDetalle(caja);
    setCargandoDetalle(true);
    setDetalleMovs(null);
    try {
      const params = new URLSearchParams();
      if (filtros?.tipo) params.set("tipo", filtros.tipo);
      if (filtros?.metodoPago) params.set("metodoPago", filtros.metodoPago);
      if (filtros?.q) params.set("q", filtros.q);
      const res = await api.get(`/caja/${caja.id}/movimientos?${params}`);
      setDetalleCaja(res.data.caja || caja);
      setDetalleMovs(res.data.movimientos || []);
      setDetalleResumen(res.data.resumen);
    } catch { setDetalleMovs(null); } finally { setCargandoDetalle(false); }
  };

  const abrirDetalle = (caja) => {
    setFiltroTipo("");
    setFiltroMetodo("");
    setFiltroBusqueda("");
    verDetalle(caja, {});
  };

  const aplicarFiltros = () => {
    if (!mostrarDetalle) return;
    verDetalle(mostrarDetalle, { tipo: filtroTipo || undefined, metodoPago: filtroMetodo || undefined, q: filtroBusqueda || undefined });
  };

  const redirect = searchParams.get("redirect");

  const cargarCajas = async (p = 1) => {
    try {
      const res = await api.get("/caja", { params: { page: p, limit: 15 } });
      setCajas(res.data.cajas || []);
      setPagination(res.data.pagination || {});
    } catch {}
  };

  useEffect(() => {
    refrescarCaja();
    cargarCajas();
  }, []);

  const verificarPassword = async () => {
    setPwError("");
    if (!pwValue) { setPwError("Ingrese su contraseña"); return; }
    try {
      await authorize(pwValue);
      if (!cajaAbierta) {
        const caja = await abrirCaja({ apertura: 0, password: pwValue });
        setPage(1);
        mostrarToast("Caja abierta correctamente");
        refrescarCaja();
        cargarCajas(1);
        if (redirect) navigate(redirect);
      } else {
        setPage(1);
        cargarCajas(1);
        if (redirect) navigate(redirect);
      }
    } catch (err) {
      setPwError(err.response?.data?.message || "Contraseña incorrecta");
    }
  };

  const cerrarCaja = async () => {
    if (!cajaSel) return;
    setCargando(true);
    try {
      await api.put(`/caja/cerrar/${cajaSel.id}`, {
        observacion: formCerrar.observacion,
        conteo,
      });
      setCajaAbierta(null);
      refrescarCaja();
      setMostrarCerrar(false);
      setCajaSel(null);
      setFormCerrar({ observacion: "" });
      setPage(1);
      mostrarToast("Caja cerrada correctamente");
      cargarCajas(1);
    } catch (err) { mostrarToast(err.response?.data?.message || "Error al cerrar caja", "error"); } finally { setCargando(false); }
  };

  const editarCaja = async () => {
    if (!cajaSel) return;
    setCargando(true);
    try {
      await api.put(`/caja/${cajaSel.id}`, {
        apertura: parseFloat(formEditar.apertura) || 0,
        observacion: formEditar.observacion,
      });
      setMostrarEditar(false);
      setCajaSel(null);
      mostrarToast("Caja actualizada");
      cargarCajas(page);
    } catch (err) { mostrarToast(err.response?.data?.message || "Error al editar", "error"); } finally { setCargando(false); }
  };

  const eliminarCaja = async () => {
    if (!eliminarId) return;
    try {
      await api.delete(`/caja/${eliminarId}`);
      setEliminarId(null);
      mostrarToast("Caja eliminada");
      cargarCajas(page);
    } catch (err) { mostrarToast(err.response?.data?.message || "Error al eliminar", "error"); }
  };

  const totalEsperado = cajaAbierta ? (cajaAbierta.apertura || 0) + (cajaAbierta.ingresos || 0) - (cajaAbierta.egresos || 0) : 0;
  const efectivoReal = cajaAbierta ? (cajaAbierta.apertura || 0) + (cajaAbierta.ingresosEfectivo || 0) - (cajaAbierta.egresos || 0) : 0;
  const puedeAnular = cajaAbierta?.estado === "ABIERTA";

  return (
    <div className="min-h-screen bg-page dark:bg-slate-900 p-6 lg:p-8">
      {!cajaAuthorized && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-page dark:bg-slate-900">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-teal-100 dark:bg-teal-900/40 rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock className="w-7 h-7 text-teal-600 dark:text-teal-400" />
              </div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">Acceso al módulo de Caja</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ingrese su contraseña para acceder.</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); verificarPassword(); }}>
              <input type="password" placeholder="Contraseña" value={pwValue} onChange={(e) => { setPwValue(e.target.value); setPwError(""); }} className={inputClass + " mb-3"} autoFocus />
              {pwError && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-3">{pwError}</p>}
              <button type="submit" disabled={!pwValue} className="w-full py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
                Acceder
              </button>
            </form>
          </div>
        </div>
      )}

      {redirect && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-400 text-sm font-medium flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          Venías de {redirect === "/ingresos" ? "Ingresos/Salidas" : "Tarifas Fijas"}. Abre la caja para continuar.
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Caja</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Control de apertura y cierre diario</p>
        </div>
        <div className="flex gap-3">
          <ExportButton data={cajas.map(c => ({ ...c, _estado: c.estado === "ABIERTA" ? "Abierta" : "Cerrada" }))} filename="caja" title="Historial de Caja" columns={[{ key: 'id', label: '#' }, { key: 'createdAt', label: 'Fecha' }, { key: 'apertura', label: 'Apertura' }, { key: 'cierre', label: 'Cierre' }, { key: '_estado', label: 'Estado' }, { key: 'observacion', label: 'Observación' }]} />
          {cajaAbierta ? (
            <button onClick={() => { setCajaSel(cajaAbierta); setFormCerrar({ observacion: "" }); setMostrarCerrar(true); }} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-lg shadow-red-600/20">
              <Lock className="w-4 h-4" />
              Cerrar Caja
            </button>
          ) : cajaAuthorized ? (
            <button onClick={async () => { try { await reabrirCaja(); setPage(1); mostrarToast("Caja abierta"); refrescarCaja(); cargarCajas(1); } catch (err) { mostrarToast(err.response?.data?.message || "Error al abrir caja", "error"); } }} disabled={loading} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-lg shadow-emerald-600/20 disabled:opacity-50">
              <Wallet className="w-4 h-4" />
              {loading ? "Abriendo..." : "Abrir Caja"}
            </button>
          ) : null}
        </div>
      </div>

      {/* ─── Resumen del día (caja abierta) ─── */}
      {cajaAbierta && (
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Caja abierta — Resumen del día</p>
            </div>
            {cajaAbierta.usuario && <span className="text-xs text-slate-500 dark:text-slate-400">Abierta por: <strong className="text-slate-700 dark:text-white">{cajaAbierta.usuario.nombre}</strong></span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 shadow-lg shadow-blue-500/20">
              <p className="text-[10px] text-blue-100 uppercase tracking-wider font-medium">Apertura</p>
              <p className="text-xl font-bold text-white mt-1">{formatValor(cajaAbierta.apertura)}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 shadow-lg shadow-emerald-500/20">
              <p className="text-[10px] text-emerald-100 uppercase tracking-wider font-medium">Ingresos</p>
              <p className="text-xl font-bold text-white mt-1">{formatValor(cajaAbierta.ingresos || 0)}</p>
              <p className="text-[10px] text-emerald-200 mt-1">Efectivo: {formatValor(cajaAbierta.ingresosEfectivo || 0)}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 shadow-lg shadow-amber-500/20">
              <p className="text-[10px] text-amber-100 uppercase tracking-wider font-medium">Tarjeta</p>
              <p className="text-xl font-bold text-white mt-1">{formatValor(cajaAbierta.ingresosTarjeta || 0)}</p>
              <p className="text-[10px] text-amber-200 mt-1">No entra en efectivo</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 shadow-lg shadow-purple-500/20">
              <p className="text-[10px] text-purple-100 uppercase tracking-wider font-medium">Transferencia</p>
              <p className="text-xl font-bold text-white mt-1">{formatValor(cajaAbierta.ingresosTransferencia || 0)}</p>
              <p className="text-[10px] text-purple-200 mt-1">No entra en efectivo</p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 shadow-lg shadow-red-500/20">
              <p className="text-[10px] text-red-100 uppercase tracking-wider font-medium">Egresos</p>
              <p className="text-xl font-bold text-white mt-1">{formatValor(cajaAbierta.egresos || 0)}</p>
            </div>
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 shadow-lg shadow-teal-500/20">
              <p className="text-[10px] text-teal-100 uppercase tracking-wider font-medium">Total</p>
              <p className="text-xl font-bold text-white mt-1">{formatValor(totalEsperado)}</p>
              <p className="text-[10px] text-teal-200 mt-1">Efectivo: {formatValor(efectivoReal)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Movimientos del día (inline, solo caja abierta) ─── */}
      {cajaAbierta && (
        <div className="mb-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Movimientos del día</p>
            <div className="flex items-center gap-2">
              <Select size="sm" value={filtroHoyTipo} onChange={val => { setPageHoy(1); setFiltroHoyTipo(val); }} options={[{ value: "", label: "Todos" }, { value: "INGRESO", label: "Ingresos" }, { value: "EGRESO", label: "Gastos" }]} placeholder="Todos" />
              <Select size="sm" value={filtroHoyMetodo} onChange={val => { setPageHoy(1); setFiltroHoyMetodo(val); }} options={[{ value: "", label: "Todos los métodos" }, { value: "efectivo", label: "Efectivo" }, { value: "tarjeta", label: "Tarjeta" }, { value: "transferencia", label: "Transferencia" }]} placeholder="Todos los métodos" />
              <button onClick={() => cargarMovsHoy(1)} className="text-xs px-2 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Filtrar</button>
            </div>
          </div>
          <div className="p-4">
            {cargandoMovsHoy ? (
              <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : movsHoy ? (
              <>
                {movsHoy.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-700">
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase">Tipo</th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase">Factura</th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase">Concepto / Detalle</th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase">Método</th>
                          <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase">Monto</th>
                          <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase">Fecha</th>
                          <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {movsHoy.map((m) => {
                          const fac = m.factura;
                          const ing = fac?.ingreso;
                          const men = fac?.mensualidad;
                          const esIngreso = m.tipo === "INGRESO";
                          const detalle = esIngreso && ing
                            ? `${ing.cliente?.nombres} ${ing.cliente?.apellidos || ""} — ${ing.vehiculo?.placa || ""}`
                            : esIngreso && men
                            ? `${men.cliente?.nombres} ${men.cliente?.apellidos || ""} — ${men.vehiculo?.placa || ""} (${men.plan?.nombre || "Mensualidad"})`
                            : m.gasto
                            ? `${m.gasto.categoria} — ${m.gasto.descripcion || ""}`
                            : "";
                          const concepto = esIngreso
                            ? (ing ? `Salida ${ing.vehiculo?.placa}` : men ? `Mensualidad ${men.vehiculo?.placa}` : m.concepto)
                            : m.concepto;
                          return (
                            <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${esIngreso ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${esIngreso ? "bg-emerald-500" : "bg-red-500"}`} />
                                  {esIngreso ? "INGRESO" : "EGRESO"}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 font-mono">{fac?.numero || "--"}</td>
                              <td className="px-3 py-2.5">
                                <p className="text-sm font-medium text-slate-700 dark:text-white">{concepto}</p>
                                {detalle && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{detalle}</p>}
                              </td>
                              <td className="px-3 py-2.5">
                                {m.metodoPago && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${metodoPagoBadge[m.metodoPago] || "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                                    {metodoPagoLabel[m.metodoPago] || m.metodoPago}
                                  </span>
                                )}
                              </td>
                              <td className={`px-3 py-2.5 text-sm font-bold text-right ${esIngreso ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                {esIngreso ? "+" : "-"}{formatValor(m.monto)}
                              </td>
                              <td className="px-3 py-2.5 text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{new Date(m.createdAt).toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => abrirEditMov(m)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400" title="Editar">
                                    <PenSquare className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => anularMovimiento(m.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400" title="Anular">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No hay movimientos con esos filtros</p>}
                <Pagination page={paginationHoy.page || 1} totalPages={paginationHoy.totalPages || 1} total={paginationHoy.total || 0} onPageChange={(p) => { setPageHoy(p); cargarMovsHoy(p); }} />
              </>
            ) : <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">Error al cargar movimientos</p>}
          </div>
        </div>
      )}

      {/* ─── Historial de Cajas ─── */}
      <div className="rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <button onClick={() => setHistorialOpen(p => !p)} className="w-full px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Historial de Cajas</p>
            <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded-full">{pagination.total || cajas.length}</span>
          </div>
          <svg className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${historialOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {historialOpen && (
          <div className="p-3">
            <div className="mb-3">
              <input type="text" placeholder="Buscar por #, usuario u observación..." value={historialSearch} onChange={e => setHistorialSearch(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
            </div>
            {(() => {
              const filtradas = cajas.filter(c => cajaAbierta ? c.id !== cajaAbierta.id : true).filter(c => {
                if (!historialSearch) return true;
                const q = historialSearch.toLowerCase();
                return c.id.toString().includes(q) || (c.usuario?.nombre || "").toLowerCase().includes(q) || (c.observacion || "").toLowerCase().includes(q);
              });
              if (filtradas.length === 0) {
                return <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">{cajas.length === 0 ? "No hay registros de caja" : "Sin resultados con ese filtro"}</p>;
              }
              const grouped = filtradas.reduce((acc, c) => {
                const d = new Date(c.createdAt);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(c);
                return acc;
              }, {});
              const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
              const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
              return sortedKeys.map(mesKey => {
                const [year, month] = mesKey.split("-");
                const items = grouped[mesKey];
                const totalApertura = items.reduce((s, c) => s + (c.apertura || 0), 0);
                const totalCierre = items.reduce((s, c) => s + (c.cierre || 0), 0);
                return (
                  <div key={mesKey} className="mb-4 last:mb-0">
                    <div className="flex items-center justify-between px-1 py-1.5 mb-1">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{`${meses[parseInt(month) - 1]} ${year}`}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{items.length} caja(s) · Apertura {formatValor(totalApertura)} · Cierre {formatValor(totalCierre)}</p>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-700">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800">
                            <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase">#</th>
                            <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase">Fecha</th>
                            <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase">Abrió</th>
                            <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase">Apertura</th>
                            <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase">Cierre</th>
                            <th className="px-2.5 py-1.5 text-center text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase">Estado</th>
                            <th className="px-2.5 py-1.5 text-center text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {items.map((caja) => (
                            <tr key={caja.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                              <td className="px-2.5 py-1.5 text-xs text-slate-400 dark:text-slate-500 font-mono">{caja.id}</td>
                              <td className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{new Date(caja.createdAt).toLocaleDateString()}</td>
                              <td className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300">{caja.usuario?.nombre || "--"}</td>
                              <td className={`px-2.5 py-1.5 text-xs font-medium text-right ${caja.apertura ? "text-slate-800 dark:text-white" : "text-slate-300 dark:text-slate-500"}`}>{caja.apertura ? formatValor(caja.apertura) : "--"}</td>
                              <td className={`px-2.5 py-1.5 text-xs font-medium text-right ${caja.cierre ? "text-slate-800 dark:text-white" : "text-slate-300 dark:text-slate-500"}`}>{caja.cierre != null && caja.cierre ? formatValor(caja.cierre) : "--"}</td>
                              <td className="px-2.5 py-1.5 text-center"><CajaEstadoBadge estado={caja.estado} /></td>
                              <td className="px-2.5 py-1.5 text-center">
                                <div className="flex items-center justify-center gap-0.5">
                                  <button onClick={() => abrirDetalle(caja)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 dark:text-slate-500 hover:text-teal-600 dark:hover:text-teal-400" title="Ver detalle">
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => { setCajaSel(caja); setFormEditar({ apertura: (caja.apertura || 0).toString(), observacion: caja.observacion || "" }); setMostrarEditar(true); }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400" title="Editar">
                                    <PenSquare className="w-3.5 h-3.5" />
                                  </button>
                                  {caja.estado === "CERRADA" && (
                                    <button onClick={() => setEliminarId(caja.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400" title="Eliminar">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              });
            })()}
            <Pagination page={pagination.page || 1} totalPages={pagination.totalPages || 1} total={pagination.total || 0} onPageChange={(p) => { setPage(p); cargarCajas(p); }} />
          </div>
        )}
      </div>

      {/* ─── Modal Cerrar ─── */}
      {mostrarCerrar && cajaSel && (
        <div className="fixed inset-0 z-50 flex justify-center items-start pt-8 pb-8 px-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMostrarCerrar(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Cerrar Caja</h2>
              <button onClick={() => setMostrarCerrar(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-400 dark:text-slate-500"><IconX /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"><p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Apertura</p><p className="text-lg font-bold text-slate-800 dark:text-white">{formatValor(cajaSel.apertura)}</p></div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800"><p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-medium">Efectivo en caja</p><p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatValor(efectivoReal)}</p></div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg"><p className="text-xs text-amber-600 dark:text-amber-400 uppercase">Tarjeta</p><p className="text-lg font-bold text-amber-700 dark:text-amber-400">{formatValor(cajaSel.ingresosTarjeta || 0)}</p></div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg"><p className="text-xs text-purple-600 dark:text-purple-400 uppercase">Transferencia</p><p className="text-lg font-bold text-purple-700 dark:text-purple-400">{formatValor(cajaSel.ingresosTransferencia || 0)}</p></div>
              </div>
              <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-800 flex items-center justify-between">
                <p className="text-xs text-teal-600 dark:text-teal-400 uppercase font-medium">Total general</p>
                <p className="text-xl font-bold text-teal-700 dark:text-teal-400">{formatValor(totalEsperado)}</p>
              </div>
              {/* Arqueo de caja */}
              <details className="border border-slate-200 dark:border-slate-600 rounded-xl">
                <summary className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-xl">Arqueo de caja (conteo de dinero)</summary>
                <div className="p-4 space-y-3 border-t border-slate-200 dark:border-slate-600">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Billetes</p>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(conteo.billetes).map(([denom]) => (
                      <div key={denom}>
                        <label className="text-xs text-slate-400">${parseInt(denom).toLocaleString()}</label>
                        <input type="number" min="0" value={conteo.billetes[denom]} onChange={(e) => setConteo(p => ({ ...p, billetes: { ...p.billetes, [denom]: parseInt(e.target.value) || 0 } }))} className={inputClass + " text-center"} />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider pt-2">Monedas</p>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(conteo.monedas).map(([denom]) => (
                      <div key={denom}>
                        <label className="text-xs text-slate-400">${parseInt(denom).toLocaleString()}</label>
                        <input type="number" min="0" value={conteo.monedas[denom]} onChange={(e) => setConteo(p => ({ ...p, monedas: { ...p.monedas, [denom]: parseInt(e.target.value) || 0 } }))} className={inputClass + " text-center"} />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-600">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Total contado</p>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-bold text-teal-600 dark:text-teal-400">{formatValor(totalConteoCalculado)}</p>
                      {totalConteoCalculado > 0 && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${Math.abs(totalConteoCalculado - totalEsperado) < 100 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                          {totalConteoCalculado >= totalEsperado ? "+" : ""}${(totalConteoCalculado - totalEsperado).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </details>

              <div>
                <label className={labelClass}>Observación (opcional)</label>
                <textarea placeholder="Nota de cierre..." value={formCerrar.observacion} onChange={(e) => setFormCerrar(p => ({ ...p, observacion: e.target.value }))} className={inputClass + " resize-none"} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => setMostrarCerrar(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">Cancelar</button>
              <button onClick={cerrarCaja} disabled={cargando} className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {cargando ? "Cerrando..." : "Cerrar Caja"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Editar ─── */}
      {mostrarEditar && cajaSel && (
        <div className="fixed inset-0 z-50 flex justify-center items-start pt-8 pb-8 px-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMostrarEditar(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">{"Editar Caja #" + (cajaSel?.id ?? "")}</h2>
              <button onClick={() => setMostrarEditar(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-400 dark:text-slate-500"><IconX /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className={labelClass}>Monto de apertura ($)</label><input type="number" min="0" value={formEditar.apertura} onChange={(e) => setFormEditar(p => ({ ...p, apertura: e.target.value }))} className={inputClass} /></div>
              <div><label className={labelClass}>Observación</label><textarea value={formEditar.observacion} onChange={(e) => setFormEditar(p => ({ ...p, observacion: e.target.value }))} className={inputClass + " resize-none"} rows={2} /></div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => setMostrarEditar(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">Cancelar</button>
              <button onClick={editarCaja} disabled={cargando} className="px-5 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">{cargando ? "Guardando..." : "Guardar Cambios"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Detalle (para cajas cerradas) ─── */}
      {mostrarDetalle && (
        <div className="fixed inset-0 z-50 flex justify-center items-start pt-8 pb-8 px-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMostrarDetalle(null)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">{"Caja #" + (mostrarDetalle?.id ?? "")}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{mostrarDetalle?.createdAt ? new Date(mostrarDetalle.createdAt).toLocaleDateString() : "--"} · <CajaEstadoBadge estado={mostrarDetalle?.estado} /></p>
              </div>
              <button onClick={() => setMostrarDetalle(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-400 dark:text-slate-500"><IconX /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"><p className="text-xs text-slate-400 dark:text-slate-500">Apertura</p><p className="text-lg font-bold text-slate-800 dark:text-white">{formatValor(mostrarDetalle?.apertura)}</p></div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800"><p className="text-xs text-emerald-600 dark:text-emerald-400">Efectivo</p><p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatValor(mostrarDetalle?.ingresosEfectivo || 0)}</p></div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg"><p className="text-xs text-amber-600 dark:text-amber-400">Tarjeta</p><p className="text-lg font-bold text-amber-700 dark:text-amber-400">{formatValor(mostrarDetalle?.ingresosTarjeta || 0)}</p></div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg"><p className="text-xs text-purple-600 dark:text-purple-400">Transferencia</p><p className="text-lg font-bold text-purple-700 dark:text-purple-400">{formatValor(mostrarDetalle?.ingresosTransferencia || 0)}</p></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"><p className="text-xs text-slate-400 dark:text-slate-500">Egresos</p><p className="text-lg font-bold text-red-600 dark:text-red-400">{formatValor(mostrarDetalle?.egresos || 0)}</p></div>
                <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-100 dark:border-teal-800"><p className="text-xs text-teal-600 dark:text-teal-400">Cierre</p><p className="text-lg font-bold text-teal-700 dark:text-teal-400">{mostrarDetalle?.cierre != null ? formatValor(mostrarDetalle.cierre) : "--"}</p></div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg"><p className="text-xs text-blue-600 dark:text-blue-400">Total ingresos</p><p className="text-lg font-bold text-blue-700 dark:text-blue-400">{formatValor(mostrarDetalle?.ingresos || 0)}</p></div>
              </div>
              {mostrarDetalle?.observacion && <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"><p className="text-xs text-slate-400 dark:text-slate-500">Observación</p><p className="text-sm text-slate-700 dark:text-slate-300">{mostrarDetalle.observacion}</p></div>}
              {mostrarDetalle?.usuario && <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"><p className="text-xs text-slate-400 dark:text-slate-500">Abrió</p><p className="text-sm text-slate-700 dark:text-slate-300">{mostrarDetalle.usuario.nombre}</p></div>}

              <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Movimientos</h3>
                  <div className="flex-1" />
                  <Select size="sm" value={filtroTipo} onChange={val => setFiltroTipo(val)} options={[{ value: "", label: "Todos" }, { value: "INGRESO", label: "Ingresos" }, { value: "EGRESO", label: "Gastos" }]} placeholder="Todos" />
                  <Select size="sm" value={filtroMetodo} onChange={val => setFiltroMetodo(val)} options={[{ value: "", label: "Todos los métodos" }, { value: "efectivo", label: "Efectivo" }, { value: "tarjeta", label: "Tarjeta" }, { value: "transferencia", label: "Transferencia" }]} placeholder="Todos los métodos" />
                  <input type="text" placeholder="Buscar..." value={filtroBusqueda} onChange={e => setFiltroBusqueda(e.target.value)} className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 w-32 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                  <button onClick={aplicarFiltros} className="text-xs px-2 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Filtrar</button>
                </div>
                {cargandoDetalle ? (
                  <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : detalleMovs ? (
                  <>
                    {detalleResumen && (
                      <div className="flex gap-4 mb-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>Total: <strong className="text-slate-800 dark:text-white">{formatValor(detalleResumen.total)}</strong></span>
                        <span className="text-emerald-600 dark:text-emerald-400">Ingresos: <strong>{formatValor(detalleResumen.ingresos)}</strong></span>
                        <span className="text-red-600 dark:text-red-400">Egresos: <strong>{formatValor(detalleResumen.egresos)}</strong></span>
                      </div>
                    )}
                    {detalleMovs.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-700">
                              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase">Tipo</th>
                              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase">Factura</th>
                              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase">Concepto / Detalle</th>
                              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase">Método</th>
                              <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase">Monto</th>
                              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-300 uppercase">Fecha</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {detalleMovs.map((m) => {
                              const fac = m.factura;
                              const ing = fac?.ingreso;
                              const men = fac?.mensualidad;
                              const esIngreso = m.tipo === "INGRESO";
                              const detalle = esIngreso && ing
                                ? `${ing.cliente?.nombres} ${ing.cliente?.apellidos || ""} — ${ing.vehiculo?.placa || ""}`
                                : esIngreso && men
                                ? `${men.cliente?.nombres} ${men.cliente?.apellidos || ""} — ${men.vehiculo?.placa || ""} (${men.plan?.nombre || "Mensualidad"})`
                                : m.gasto
                                ? `${m.gasto.categoria} — ${m.gasto.descripcion || ""}`
                                : "";
                              const concepto = esIngreso
                                ? (ing ? `Salida ${ing.vehiculo?.placa}` : men ? `Mensualidad ${men.vehiculo?.placa}` : m.concepto)
                                : m.concepto;
                              return (
                                <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                                  <td className="px-3 py-2.5">
                                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${esIngreso ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${esIngreso ? "bg-emerald-500" : "bg-red-500"}`} />
                                      {esIngreso ? "INGRESO" : "EGRESO"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 font-mono">{fac?.numero || "--"}</td>
                                  <td className="px-3 py-2.5">
                                    <p className="text-sm font-medium text-slate-700 dark:text-white">{concepto}</p>
                                    {detalle && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{detalle}</p>}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    {m.metodoPago && (
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${metodoPagoBadge[m.metodoPago] || "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                                        {metodoPagoLabel[m.metodoPago] || m.metodoPago}
                                      </span>
                                    )}
                                  </td>
                                  <td className={`px-3 py-2.5 text-sm font-bold text-right ${esIngreso ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                    {esIngreso ? "+" : "-"}{formatValor(m.monto)}
                                  </td>
                                  <td className="px-3 py-2.5 text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{new Date(m.createdAt).toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No hay movimientos con esos filtros</p>}
                  </>
                ) : <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">Error al cargar movimientos</p>}
              </div>
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
              <button onClick={() => setMostrarDetalle(null)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Editar Movimiento ─── */}
      {editMovimiento && (
        <div className="fixed inset-0 z-50 flex justify-center items-start pt-8 pb-8 px-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditMovimiento(null)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">{`Editar Movimiento #${editMovimiento.id}`}</h2>
              <button onClick={() => setEditMovimiento(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-400 dark:text-slate-500"><IconX /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelClass}>Concepto</label>
                <input type="text" value={formEditMov.concepto} onChange={(e) => setFormEditMov(p => ({ ...p, concepto: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Monto ($)</label>
                <input type="number" min="0" step="0.01" value={formEditMov.monto} onChange={(e) => setFormEditMov(p => ({ ...p, monto: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <SelectWithOther
                  label="Método de pago"
                  name="metodoPago"
                  value={formEditMov.metodoPago}
                  onChange={(e) => setFormEditMov(p => ({ ...p, metodoPago: e.target.value }))}
                  options={getMetodosPagoActivos(config).map(m => ({ value: m.key, label: m.label }))}
                  otherLabel="Otro método"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => setEditMovimiento(null)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">Cancelar</button>
              <button onClick={guardarEditMov} className="px-5 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog abierto={!!eliminarId} titulo="Eliminar caja" mensaje="¿Estás seguro de eliminar este registro de caja? Esta acción no se puede deshacer." onConfirm={eliminarCaja} onCancel={() => setEliminarId(null)} />
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
      <ScrollLock cuando={mostrarCerrar || mostrarEditar || !!mostrarDetalle || !!editMovimiento} />
    </div>
  );
}

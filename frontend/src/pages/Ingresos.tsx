import { useEffect, useState, useCallback } from "react";
import { LogIn, LogOut, Search, X, Clock, PenSquare, Trash2, CheckCircle, Ticket, Car } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCaja } from "../context/CajaContext";
import { useConfig } from "../context/ConfigContext";
import api from "../services/api";
import Select from "../components/ui/Select";
import Pagination from "../components/Pagination";
import ExportButton from "../components/ExportButton";
import Toast from "../components/Toast";
import ScrollLock from "../components/ScrollLock";
import ConfirmDialog from "../components/ConfirmDialog";
import { formatCurrency, getMetodosPagoActivos } from "../utils/formatters";
import FormModal from "../components/ui/FormModal";
import SelectWithOther from "../components/SelectWithOther";
import ClientSearch from "../components/ClientSearch";
import useDebounce from "../hooks/useDebounce";
import { TableSkeleton } from "../components/Skeleton";
const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";

const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";

const inputDisabled = "w-full px-3 py-2.5 border border-slate-100 dark:border-slate-600 rounded-lg text-sm text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700";
function IconLogIn() {
  return <LogIn className="w-4 h-4" />;
}

function IconLogOut() {
  return <LogOut className="w-4 h-4" />;
}

function IconSearch() {
  return <Search className="w-5 h-5 text-slate-400" />;
}

function IconX() {
  return <X className="w-5 h-5" />;
}

function IconClock() {
  return <Clock className="w-4 h-4" />;
}

function IconEdit() {
  return <PenSquare className="w-3.5 h-3.5" />;
}

function IconTrash() {
  return <Trash2 className="w-3.5 h-3.5" />;
}

function EstadoIngresoBadge({ estado }) {
  if (estado === "ACTIVO") return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Activo</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Finalizado</span>;
}

export default function Ingresos() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const { requestAbrirCaja } = useCaja();
  const [ingresos, setIngresos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vehiculosDelCliente, setVehiculosDelCliente] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarModalEntrada, setMostrarModalEntrada] = useState(false);
  const [mostrarModalSalida, setMostrarModalSalida] = useState(false);
  const [editandoIngreso, setEditandoIngreso] = useState(null);
  const [eliminarId, setEliminarId] = useState(null);
  const [ingresoSalida, setIngresoSalida] = useState(null);
  const [metodoPagoSalida, setMetodoPagoSalida] = useState("efectivo");
  const [simulacion, setSimulacion] = useState(null);
  const [modalidadSalida, setModalidadSalida] = useState("hora");
  const [recibidoSalida, setRecibidoSalida] = useState("");
  const [ticketExtraviado, setTicketExtraviado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cajaInfo, setCajaInfo] = useState(null);
  const [cargandoSimulacion, setCargandoSimulacion] = useState(false);
  const [errorSimulacion, setErrorSimulacion] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [initialLoading, setInitialLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const busquedaDebounced = useDebounce(busqueda);

  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const mostrarToast = useCallback((mensaje, tipo = "success") => setToast({ mensaje, tipo }), []);

  const [formEntrada, setFormEntrada] = useState({ clienteId: "", vehiculoId: "", puestoId: "", observaciones: "" });
  const [ingresosActivosCliente, setIngresosActivosCliente] = useState([]);

  const cargarIngresos = async (p = 1) => {
    try {
      const params = { page: p };
      if (filtroEstado !== "TODOS") params.estado = filtroEstado;
      if (busqueda) params.q = busqueda;
      const res = await api.get("/ingresos", { params });
      setIngresos(res.data.ingresos || []);
      setPagination(res.data.pagination || {});
    } catch (error) { console.log(error); }
    finally { setInitialLoading(false); }
  };
  const cargarClientes = async () => {
    try { const res = await api.get("/clientes"); setClientes(res.data.clientes || []); } catch (error) { console.log(error); }
  };
  const cargarVehiculosDelCliente = async (clienteId) => {
    if (!clienteId) { setVehiculosDelCliente([]); setIngresosActivosCliente([]); return; }
    try {
      const [vehRes, ingRes] = await Promise.all([
        api.get("/vehiculos", { params: { clienteId, limit: 100 } }),
        api.get("/ingresos", { params: { clienteId, estado: "ACTIVO", limit: 50 } }),
      ]);
      setVehiculosDelCliente(vehRes.data.vehiculos || []);
      setIngresosActivosCliente(ingRes.data.ingresos || []);
    } catch (error) { console.log(error); }
  };
  const cargarPuestos = async () => {
    try { const res = await api.get("/puestos"); setPuestos(res.data.puestos || []); } catch (error) { console.log(error); }
  };

  useEffect(() => { setPage(1); }, [filtroEstado]);
  useEffect(() => { cargarIngresos(page); }, [page, filtroEstado]);
  useEffect(() => { cargarIngresos(1); }, [busquedaDebounced]);
  useEffect(() => { cargarClientes(); cargarPuestos(); }, []);
  const puestosLibres = puestos.filter(p => p.estado === "LIBRE");

  const registrarEntrada = async () => {
    setCargando(true);
    try {
      if (editandoIngreso) {
        await api.put(`/ingresos/${editandoIngreso.id}`, {
          vehiculoId: parseInt(formEntrada.vehiculoId),
          puestoId: parseInt(formEntrada.puestoId),
        });
        mostrarToast("Entrada actualizada correctamente", "success");
      } else {
        const res = await api.post("/ingresos", {
          clienteId: parseInt(formEntrada.clienteId),
          vehiculoId: parseInt(formEntrada.vehiculoId),
          puestoId: formEntrada.puestoId ? parseInt(formEntrada.puestoId) : undefined,
        });
        mostrarToast(res.data.reservaAsignada ? "Entrada registrada — Puesto asignado por reserva" : "Entrada registrada correctamente", "success");
      }
      setMostrarModalEntrada(false);
      setEditandoIngreso(null);
      setFormEntrada({ clienteId: "", vehiculoId: "", puestoId: "", observaciones: "" });
      cargarIngresos();
      cargarPuestos();
    } catch (error) {
      mostrarToast(error.response?.data?.message || "Error al registrar entrada", "error");
    } finally { setCargando(false); }
  };

  const [pagoExitoso, setPagoExitoso] = useState(null);

  const registrarSalida = async (idForzado) => {
    const id = idForzado || ingresoSalida?.id;
    if (!id) return;
    setCargando(true);
    try {
      const res = await api.post(`/ingresos/salida-con-cobro/${id}`, { metodoPago: metodoPagoSalida, modalidad: modalidadSalida, ticketExtraviado });
      setMostrarModalSalida(false);
      setIngresoSalida(null);
      setSimulacion(null);
      setMetodoPagoSalida("efectivo");
      setRecibidoSalida("");
      setCajaInfo(res.data.caja);
      cargarIngresos();
      cargarPuestos();
      setPagoExitoso(res.data);
    } catch (error) {
      const msg = error.response?.data?.message || "";
      if (msg.includes("ya fue finalizado")) {
        mostrarToast("Este ingreso ya fue cobrado anteriormente", "error");
        setMostrarModalSalida(false);
        cargarIngresos();
        setTimeout(() => {
          setIngresoSalida(null);
          setSimulacion(null);
        }, 50);
      } else if (msg.includes("Caja cerrada")) {
        setCargando(false);
        const opened = await requestAbrirCaja();
        if (opened) navigate("/caja");
      } else {
        mostrarToast(msg || "Error al registrar salida", "error");
      }
    } finally { setCargando(false); }
  };




  const abrirEntrada = (datos) => {
    if (datos?.editando) {
      setFormEntrada({
        clienteId: datos.clienteId?.toString() || "",
        vehiculoId: datos.vehiculoId?.toString() || "",
        puestoId: datos.puestoId?.toString() || "",
        observaciones: "",
      });
      setEditandoIngreso(datos);
      cargarVehiculosDelCliente(datos.clienteId);
    } else if (datos) {
      setFormEntrada({
        clienteId: datos.clienteId?.toString() || "",
        vehiculoId: datos.vehiculoId?.toString() || "",
        puestoId: "",
        observaciones: "",
      });
      setEditandoIngreso(null);
      cargarVehiculosDelCliente(datos.clienteId);
    } else {
      setFormEntrada({ clienteId: "", vehiculoId: "", puestoId: "", observaciones: "" });
      setEditandoIngreso(null);
      setVehiculosDelCliente([]);
    }
    setMostrarModalEntrada(true);
  };

  const eliminarIngreso = async () => {
    if (!eliminarId) return;
    setCargando(true);
    try {
      await api.delete(`/ingresos/${eliminarId}`);
      setEliminarId(null);
      cargarIngresos();
      mostrarToast("Ingreso eliminado correctamente", "success");
    } catch (error) {
      mostrarToast(error.response?.data?.message || "Error al eliminar ingreso", "error");
    } finally { setCargando(false); }
  };

  const simularCobro = useCallback(async (extraviado) => {
    if (!ingresoSalida) return;
    setCargandoSimulacion(true);
    try {
      const res = await api.post("/ingresos/simular-cobro", { ingresoId: ingresoSalida.id, ticketExtraviado: extraviado });
      setSimulacion(res.data.cobro);
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error || error.message || "Error al calcular cobro";
      setErrorSimulacion(msg);
      setSimulacion(null);
    } finally { setCargandoSimulacion(false); }
  }, [ingresoSalida]);

  const abrirSalida = async (ingreso) => {
    setIngresoSalida(ingreso);
    setMetodoPagoSalida("efectivo");
    setRecibidoSalida("");
    setModalidadSalida("hora");
    setSimulacion(null);
    setErrorSimulacion("");
    setTicketExtraviado(false);
    setMostrarModalSalida(true);
    simularCobro(false);
  };

  useEffect(() => {
    if (!mostrarModalSalida || !ingresoSalida) return;
    simularCobro(ticketExtraviado);
  }, [ticketExtraviado]);

  const activos = ingresos.filter(i => i.estado === "ACTIVO");
  const filtrados = ingresos;

  const formatValor = (v) => formatCurrency(v);
  const formatTiempo = (min) => {
    if (!min) return "—";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="min-h-screen bg-page dark:bg-slate-900 p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Ingresos / Salidas</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Control de entrada y salida de vehículos</p>
        </div>
        <div className="flex gap-3">
          <ExportButton data={filtrados.map(i => ({ Estado: i.estado === "ACTIVO" ? "Activo" : "Finalizado", Cliente: `${i.cliente?.nombres || ""} ${i.cliente?.apellidos || ""}`.trim(), Placa: i.vehiculo?.placa || "", Puesto: i.puesto?.codigo || "", Entrada: i.fechaEntrada ? new Date(i.fechaEntrada).toLocaleString("es-CO") : "", Salida: i.fechaSalida ? new Date(i.fechaSalida).toLocaleString("es-CO") : "", Valor: `$${(i.valorPagado || 0).toLocaleString()}` }))} filename="ingresos" title="Ingresos / Salidas" columns={[{ key: 'Estado', label: 'Estado' }, { key: 'Cliente', label: 'Cliente' }, { key: 'Placa', label: 'Placa' }, { key: 'Puesto', label: 'Puesto' }, { key: 'Entrada', label: 'Entrada' }, { key: 'Salida', label: 'Salida' }, { key: 'Valor', label: 'Valor' }]} />
          <button onClick={abrirEntrada} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-lg shadow-emerald-600/20 active:scale-[0.98]">
            <IconLogIn /> Registrar Entrada
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-3.5 shadow-sm">
          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-medium">Activos ahora</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{activos.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-3.5 shadow-sm">
          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-medium">Puestos libres</p>
          <p className="text-2xl font-bold text-teal-600 mt-1">{puestosLibres.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-3.5 shadow-sm">
          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-medium">Total hoy</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{ingresos.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-3.5 shadow-sm">
          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-medium">Puestos totales</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{puestos.length}</p>
        </div>
      </div>

      <div className="p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 dark:bg-slate-800 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center"><IconSearch className="text-slate-400 dark:text-slate-500" /></div>
            <input type="text" placeholder="Buscar por cliente, placa o puesto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" />
          </div>
          <div className="flex gap-2">
            {["TODOS", "ACTIVO", "FINALIZADO"].map(opt => (
              <button key={opt} onClick={() => setFiltroEstado(opt)} className={`px-4 py-2 text-xs font-medium rounded-lg border transition-all ${filtroEstado === opt ? "bg-slate-800 dark:bg-slate-600 text-white border-slate-800 dark:border-slate-600" : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"}`}>
                {opt === "TODOS" ? "Todos" : opt === "ACTIVO" ? "Activos" : "Finalizados"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {initialLoading ? <TableSkeleton rows={8} cols={9} /> : (
      <div className="rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800 dark:bg-slate-700">
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Estado</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Cliente</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Vehículo</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Puesto</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Entrada</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Salida</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Tiempo</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Valor</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtrados.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center"><p className="text-slate-400 dark:text-slate-500 text-sm">No hay registros de ingreso</p></td></tr>
              ) : (
                filtrados.map((ing) => (
                  <tr key={ing.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/50 ${ing.estado === "ACTIVO" ? "bg-emerald-50/30 dark:bg-emerald-900/10" : ""}`}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <EstadoIngresoBadge estado={ing.estado} />
                        {ing.esAusencia && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-700 whitespace-nowrap">
                            Ausencia
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-slate-800 dark:text-white">{ing.cliente?.nombres} {ing.cliente?.apellidos}</p>
                    </td>
                    <td className="px-4 py-3.5"><span className="font-mono text-sm font-bold text-teal-700 dark:text-teal-400">{ing.vehiculo?.placa || "—"}</span></td>
                    <td className="px-4 py-3.5"><span className="font-mono text-sm text-slate-600 dark:text-slate-400">{ing.puesto?.codigo || "—"}</span></td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-400">{ing.fechaEntrada ? new Date(ing.fechaEntrada).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h12" }) : "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-400">{ing.fechaSalida ? new Date(ing.fechaSalida).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h12" }) : "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-400 text-center">
                      <span className="inline-flex items-center gap-1"><IconClock className="text-slate-400 dark:text-slate-500" /> {formatTiempo(ing.tiempoMinutos)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-white text-right">{ing.valorPagado ? formatValor(ing.valorPagado) : "—"}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        {ing.estado === "ACTIVO" && (
                          <>
                            <button onClick={() => abrirSalida(ing)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg">
                              <IconLogOut /> Salida
                            </button>
                            <button onClick={() => abrirEntrada({ ...ing, editando: true })} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg">
                              <IconEdit /> Editar
                            </button>
                          </>
                        )}
                        {ing.estado === "FINALIZADO" && (
                          <>
                            <button onClick={() => abrirEntrada(ing)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                              <IconLogIn /> Entrada
                            </button>
                            <button onClick={() => window.open(`/api/ingresos/${ing.id}/ticket`, '_blank')} className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
                              Ticket
                            </button>
                            <button onClick={() => setEliminarId(ing.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg">
                              <IconTrash /> Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={pagination.page || 1} totalPages={pagination.totalPages || 1} total={pagination.total || 0} onPageChange={setPage} />
      </div>
      )}

      <FormModal
        open={mostrarModalEntrada}
        onClose={() => { setMostrarModalEntrada(false); setEditandoIngreso(null); setIngresosActivosCliente([]); }}
        gradient="from-blue-600 to-cyan-500"
        icon={LogIn}
        titulo={editandoIngreso ? "Editar Entrada" : "Registrar Entrada"}
        subtitulo={editandoIngreso ? "Modifica los datos de la entrada activa" : "Selecciona cliente, vehículo y puesto"}
        footer={
          <>
            <button onClick={() => { setMostrarModalEntrada(false); setEditandoIngreso(null); }} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">Cancelar</button>
            <button onClick={registrarEntrada} disabled={cargando || (!editandoIngreso && (!formEntrada.clienteId || !formEntrada.vehiculoId || !formEntrada.puestoId))} className={`px-5 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${editandoIngreso ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {cargando ? "Guardando..." : editandoIngreso ? "Guardar Cambios" : "Registrar Entrada"}
            </button>
          </>
        }
      >
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
          <div>
            <label className={labelClass}>Cliente</label>
            {editandoIngreso ? (
              <div className={inputDisabled}>{editandoIngreso.cliente?.nombres} {editandoIngreso.cliente?.apellidos}</div>
            ) : (
              <ClientSearch value={formEntrada.clienteId} onChange={(id) => { const val = id?.toString() || ""; setFormEntrada(p => ({ ...p, clienteId: val, vehiculoId: "" })); cargarVehiculosDelCliente(val); }} placeholder="Buscar cliente por nombre o documento..." />
            )}
          </div>
          {ingresosActivosCliente.length > 0 && !editandoIngreso && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Car className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Este cliente ya tiene {ingresosActivosCliente.length} vehículo{ingresosActivosCliente.length > 1 ? "s" : ""} registrado{ingresosActivosCliente.length > 1 ? "s" : ""}</p>
                  <div className="mt-2 space-y-1.5">
                    {ingresosActivosCliente.map(ing => (
                      <div key={ing.id} className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400">
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800/40 rounded font-mono font-bold">{ing.vehiculo?.placa || "—"}</span>
                        <span className="text-blue-400 dark:text-blue-500">→</span>
                        <span className="font-medium">{ing.puesto?.codigo || "Sin puesto"}</span>
                        <span className="text-blue-300 dark:text-blue-600">·</span>
                        <span>{ing.vehiculo?.tipo || ""}</span>
                        <span className="text-blue-300 dark:text-blue-600">·</span>
                        <span>{new Date(ing.fechaEntrada).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-2 italic">Puede registrar otro vehículo para este cliente.</p>
                </div>
              </div>
            </div>
          )}
          <div>
            <label className={labelClass}>Vehículo</label>
            <Select value={formEntrada.vehiculoId} onChange={(val) => setFormEntrada(p => ({ ...p, vehiculoId: val }))} options={[
              { value: "", label: formEntrada.clienteId ? "Cargando vehículos..." : "Seleccionar cliente primero..." },
              ...vehiculosDelCliente.map(v => ({ value: String(v.id), label: `${v.placa} — ${v.marca} ${v.modelo}${v.tipo ? ` (${v.tipo})` : ''}` })),
            ]} placeholder={formEntrada.clienteId ? "Cargando vehículos..." : "Seleccionar cliente primero..."} />
          </div>
          <div>
            <label className={labelClass}>Puesto</label>
            <Select value={formEntrada.puestoId} onChange={(val) => setFormEntrada(p => ({ ...p, puestoId: val }))} options={[
              { value: "", label: "Seleccionar puesto..." },
              ...puestosLibres.map(p => ({ value: String(p.id), label: `${p.codigo} (${p.tipoPuesto})` })),
            ]} placeholder="Seleccionar puesto..." />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{`Solo se muestran puestos libres (${puestosLibres.length} disponibles)`}</p>
          </div>
        </div>
      </FormModal>

      <FormModal
        open={mostrarModalSalida && !!ingresoSalida}
        onClose={() => { setMostrarModalSalida(false); setErrorSimulacion(""); }}
        gradient="from-amber-600 to-orange-500"
        icon={LogOut}
        titulo="Registrar Salida"
        subtitulo="Revisa el desglose antes de confirmar"
        footer={
          <>
            <button onClick={() => { setMostrarModalSalida(false); setErrorSimulacion(""); }} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">Cancelar</button>
            <button onClick={() => registrarSalida()} disabled={cargando} className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
              {cargando ? "Procesando..." : "Confirmar Salida"}
            </button>
          </>
        }
      >
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-2">
            <div className="flex justify-between"><span className="text-sm text-slate-500 dark:text-slate-400">Cliente:</span><span className="text-sm font-semibold dark:text-white">{ingresoSalida?.cliente?.nombres || "—"} {ingresoSalida?.cliente?.apellidos || ""}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500 dark:text-slate-400">Vehículo:</span><span className="text-sm font-bold font-mono dark:text-white">{ingresoSalida?.vehiculo?.placa || "—"}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500 dark:text-slate-400">Puesto:</span><span className="text-sm font-mono dark:text-slate-300">{ingresoSalida?.puesto?.codigo || "—"}</span></div>
            <div className="flex justify-between"><span className="text-sm text-slate-500 dark:text-slate-400">Entrada:</span><span className="text-sm dark:text-slate-300">{ingresoSalida?.fechaEntrada ? new Date(ingresoSalida.fechaEntrada).toLocaleString() : "—"}</span></div>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer hover:border-amber-300 transition-all">
            <input type="checkbox" checked={ticketExtraviado} onChange={(e) => { setTicketExtraviado(e.target.checked); }} className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/20" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-amber-500" />
                Perdió el ticket
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Se cobrará la tarifa máxima del día</p>
            </div>
          </label>

          {cargandoSimulacion ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-center text-sm text-slate-400 dark:text-slate-500">Calculando cobro...</div>
          ) : errorSimulacion ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-1">Error al calcular cobro</p>
              <p className="text-sm text-red-600 dark:text-red-300">{errorSimulacion}</p>
              <p className="text-xs text-red-500 dark:text-red-400 mt-2">Verificá que el vehículo tenga un tipo asignado (moto, carro, camioneta, bicicleta u otro) y que exista una tarifa activa para ese tipo.</p>
            </div>
          ) : simulacion?.plan ? (
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 space-y-2">
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Plan Activo</p>
              <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">Plan:</span><span className="font-bold text-purple-700 dark:text-purple-400" style={{ textTransform: 'capitalize' }}>{simulacion.plan}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">Tiempo en este ingreso:</span><span className="font-medium dark:text-white">{`${Math.floor(simulacion.totalMinutos/60)}h ${simulacion.totalMinutos%60}m`}</span></div>
              <p className="text-xs text-purple-600 dark:text-purple-300 mt-1">El cliente ya pagó su plan. No se generará cobro adicional al registrar la salida.</p>
            </div>
          ) : simulacion && (
            <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-800 space-y-2">
              <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider">Desglose de Cobro</p>
              <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">Tiempo total:</span><span className="font-medium dark:text-white">{`${simulacion.totalMinutos} min (${Math.floor(simulacion.totalMinutos/60)}h ${simulacion.totalMinutos%60}m)`}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">Tarifa aplicada:</span><span className="font-medium dark:text-white">{`${simulacion.tarifa?.nombre} (${simulacion.tarifa?.modalidad})`}</span></div>
              {simulacion.minutosCortesia > 0 && (
                <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">Cortesía:</span><span className="font-medium text-emerald-600 dark:text-emerald-400">{`-${simulacion.minutosCortesia} min`}</span></div>
              )}
              <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">Minutos facturables:</span><span className="font-medium dark:text-white">{`${simulacion.minutosFacturables} min`}</span></div>
              <div className="border-t border-teal-200 dark:border-teal-800 pt-2 mt-2">
                {simulacion.detalle?.map((d, i) => (
                  <div key={i} className="flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>{d.concepto}</span><span className="font-medium dark:text-white">${d.valor?.toLocaleString()}</span></div>
                ))}
              </div>
              <div className="border-t border-teal-200 dark:border-teal-800 pt-2 flex justify-between text-lg font-bold">
                <span className="text-teal-800 dark:text-teal-300">TOTAL</span>
                <span className="text-teal-800 dark:text-teal-300">${simulacion.total?.toLocaleString()}</span>
              </div>
            </div>
          )}

          {(!simulacion?.plan) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <SelectWithOther
                  label="Método de pago"
                  name="metodoPago"
                  value={metodoPagoSalida}
                  onChange={(e) => setMetodoPagoSalida(e.target.value)}
                  options={getMetodosPagoActivos(config).map(m => ({ value: m.key, label: m.label }))}
                  otherLabel="Otro"
                />
              </div>
              <div>
                <SelectWithOther
                  label="Modalidad de cobro"
                  name="modalidad"
                  value={modalidadSalida}
                  onChange={(e) => setModalidadSalida(e.target.value)}
                  options={[
                    { value: "hora", label: "Por hora" },
                    { value: "minuto", label: "Por minuto" },
                    { value: "diario", label: "Diario" },
                    { value: "semanal", label: "Semanal" },
                    { value: "quincenal", label: "Quincenal" },
                    { value: "mensual", label: "Mensual" },
                  ]}
                  otherLabel="Otra modalidad"
                />
              </div>
            </div>
          )}

          {metodoPagoSalida === "efectivo" && simulacion && !simulacion.plan && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 space-y-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Calculo de Vuelto</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Total a cobrar:</span>
                <span className="font-bold dark:text-white">${simulacion.total?.toLocaleString()}</span>
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Recibi ($)</label>
                <input type="number" min="0" value={recibidoSalida} onChange={(e) => setRecibidoSalida(e.target.value)}
                  className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" placeholder="0" />
              </div>
              {parseFloat(recibidoSalida || 0) > 0 && (
                <div className={`flex justify-between text-sm font-bold ${parseFloat(recibidoSalida) < simulacion.total ? 'text-red-600' : 'text-emerald-700'}`}>
                  {parseFloat(recibidoSalida) >= simulacion.total ? (
                    <><span>Vuelto:</span><span>${(parseFloat(recibidoSalida) - simulacion.total).toLocaleString()}</span></>
                  ) : (
                    <><span>Faltan:</span><span>${(simulacion.total - parseFloat(recibidoSalida)).toLocaleString()}</span></>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </FormModal>

      <FormModal
        open={!!pagoExitoso}
        onClose={() => setPagoExitoso(null)}
        gradient="from-emerald-600 to-teal-500"
        icon={CheckCircle}
        titulo={pagoExitoso?.renovada ? "Mensualidad renovada" : pagoExitoso?.cobro?.total === 0 ? "Salida registrada" : "Pago registrado"}
        size="max-w-md"
        footer={
          <div className="flex gap-3 w-full">
            <button onClick={() => setPagoExitoso(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer">Seguir en Ingresos</button>
            <button onClick={() => { setPagoExitoso(null); navigate("/caja"); }} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 cursor-pointer">Ir a Caja</button>
          </div>
        }
      >
        <div className="text-center">
          {pagoExitoso?.factura ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Factura <strong className="dark:text-white">{pagoExitoso?.factura?.numero}</strong></p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{pagoExitoso?.message || "Salida registrada"}</p>
          )}
          {pagoExitoso?.cobro && (
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2 text-sm text-left">
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Tiempo:</span><span className="font-medium dark:text-white">{`${Math.floor(pagoExitoso.cobro.totalMinutos/60)}h ${pagoExitoso.cobro.totalMinutos%60}m`}</span></div>
              {pagoExitoso.cobro.total > 0 && (
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Valor pagado:</span><span className="font-bold text-emerald-700 dark:text-emerald-400">${Number(pagoExitoso.valorPagado || pagoExitoso.cobro.total).toLocaleString()}</span></div>
              )}
            </div>
          )}
          {cajaInfo && (
            <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 space-y-1.5 text-sm text-left">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Caja actual</p>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Ingresos acumulados:</span><span className="font-medium text-slate-800 dark:text-white">${Number(cajaInfo.ingresos).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Saldo actual:</span><span className="font-bold text-emerald-700 dark:text-emerald-400">${Number(cajaInfo.saldo).toLocaleString()}</span></div>
            </div>
          )}
        </div>
      </FormModal>

      <ConfirmDialog
        abierto={!!eliminarId}
        titulo="Eliminar ingreso"
        mensaje="¿Estás seguro de eliminar este ingreso? Esta acción no se puede deshacer."
        onConfirm={eliminarIngreso}
        onCancel={() => setEliminarId(null)}
      />
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
      <ScrollLock cuando={mostrarModalEntrada || mostrarModalSalida || !!pagoExitoso} />
    </div>
  );
}

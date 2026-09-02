import { useEffect, useState, useCallback } from "react";
import { Calendar, CalendarClock, Plus, Search, X, Banknote, RefreshCw, PenSquare, Trash2, XCircle, MoreVertical, MessageCircle, CheckCircle, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCaja } from "../context/CajaContext";
import { useConfig } from "../context/ConfigContext";
import useDebounce from "../hooks/useDebounce";
import ScrollLock from "../components/ScrollLock";
import { formatCurrency, getMetodosPagoActivos } from "../utils/formatters";
import api from "../services/api";
import Pagination from "../components/Pagination";
import Toast from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import SelectWithOther from "../components/SelectWithOther";
import Select from "../components/ui/Select";
import FormModal from "../components/ui/FormModal";
import ExportButton from "../components/ExportButton";
import ClientSearch from "../components/ClientSearch";
import { TableSkeleton } from "../components/Skeleton";

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";

function IconCalendar() {
  return <Calendar className="w-4 h-4" />;
}

function IconPlus() {
  return <Plus className="w-5 h-5" />;
}

function IconSearch() {
  return <Search className="w-5 h-5 text-slate-400" />;
}

function IconX() {
  return <X className="w-5 h-5" />;
}

function IconCash() {
  return <Banknote className="w-4 h-4" />;
}

function IconRefresh() {
  return <RefreshCw className="w-4 h-4" />;
}

function EstadoMensualidadBadge({ estado, vencida }) {
  if (vencida) {
    return <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">Vencida</span>;
  }
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${estado === "ACTIVA" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"}`}>
      {estado || "ACTIVA"}
    </span>
  );
}

function IconEdit() {
  return <PenSquare className="w-3.5 h-3.5" />;
}

function IconTrash() {
  return <Trash2 className="w-3.5 h-3.5" />;
}

function IconXCircle() {
  return <XCircle className="w-4 h-4" />;
}

export default function Mensualidades() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const { requestAbrirCaja } = useCaja();
  const [mensualidades, setMensualidades] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vehiculosDelCliente, setVehiculosDelCliente] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const busquedaDebounced = useDebounce(busqueda);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [eliminarId, setEliminarId] = useState(null);
  const [cancelarId, setCancelarId] = useState(null);
  const [cobrarId, setCobrarId] = useState(null);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [montoAbono, setMontoAbono] = useState("");
  const [recibidoMensualidad, setRecibidoMensualidad] = useState("");
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showOtroPlan, setShowOtroPlan] = useState(false);
  const [cajaInfo, setCajaInfo] = useState(null);
  const [pagoExitoso, setPagoExitoso] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [generandoFacturas, setGenerandoFacturas] = useState(false);

  const formVacio = { clienteId: "", vehiculoId: "", puestoId: "", planId: "", fechaInicio: "", fechaFin: "", valor: "", observacion: "" };
  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const [confirm, setConfirm] = useState({ abierto: false, titulo: "", mensaje: "", onConfirm: () => {} });
  const mostrarToast = useCallback((mensaje, tipo = "success") => setToast({ mensaje, tipo }), []);

  const [form, setForm] = useState(formVacio);

  const generarFacturas = async () => {
    setGenerandoFacturas(true);
    try {
      const res = await api.post("/mensualidades/generar-facturas");
      mostrarToast(res.data.message || "Facturas generadas correctamente", "success");
      cargarMensualidades();
    } catch (err) { mostrarToast(err.response?.data?.message || "Error al generar facturas", "error"); }
    finally { setGenerandoFacturas(false); }
  };

  const cargarMensualidades = async (p = 1) => {
    try {
      const params = { page: p };
      if (busqueda) params.q = busqueda;
      if (filtroEstado) params.estado = filtroEstado;
      const res = await api.get("/mensualidades", { params });
      setMensualidades(res.data.mensualidades || []);
      setPagination(res.data.pagination || {});
    } catch (error) { console.log(error); }
    finally { setInitialLoading(false); }
  };

  const cargarClientes = async () => {
    try { const res = await api.get("/clientes"); setClientes(res.data.clientes || []); } catch (error) { console.log(error); }
  };

  const cargarVehiculosDelCliente = async (clienteId) => {
    if (!clienteId) { setVehiculosDelCliente([]); return; }
    try {
      const res = await api.get("/vehiculos", { params: { clienteId, limit: 100 } });
      setVehiculosDelCliente(res.data.vehiculos || []);
    } catch (error) { console.log(error); }
  };

  const cargarPlanes = async () => {
    try { const res = await api.get("/planes"); setPlanes((res.data.planes || []).filter(p => p.activo)); } catch { console.log("error"); }
  };

  useEffect(() => { cargarMensualidades(page); cargarPlanes(); }, [page, filtroEstado]);
  useEffect(() => { cargarMensualidades(1); cargarPlanes(); }, [busquedaDebounced]);
  const cargarPuestos = async () => {
    try { const res = await api.get("/puestos?limit=500"); setPuestos(res.data.puestos || []); } catch { }
  };
  useEffect(() => { cargarClientes(); cargarPuestos(); }, []);

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const guardarMensualidad = async () => {
    if (!form.clienteId || !form.vehiculoId) { mostrarToast("Selecciona cliente y vehículo", "error"); return; }
    if (!form.fechaInicio) { mostrarToast("Selecciona fecha de inicio", "error"); return; }
    if (!form.valor || parseFloat(form.valor) <= 0) { mostrarToast("Ingresa un valor válido", "error"); return; }
    setCargando(true);
    try {
      const fin = form.fechaFin || new Date(new Date(form.fechaInicio).getTime() + 30 * 86400000).toISOString().split("T")[0];
      const payload = {
        clienteId: parseInt(form.clienteId),
        vehiculoId: parseInt(form.vehiculoId),
        fechaInicio: form.fechaInicio,
        fechaFin: fin,
        valor: parseFloat(form.valor),
        observacion: form.observacion,
      };
      if (form.planId) payload.planId = parseInt(form.planId);
      if (form.puestoId) payload.puestoId = parseInt(form.puestoId);
      if (editando) {
        await api.put(`/mensualidades/${editando.id}`, payload);
        mostrarToast("Suscripción actualizada correctamente", "success");
      } else {
        await api.post("/mensualidades", payload);
        mostrarToast("Suscripción creada correctamente", "success");
      }
      setMostrarModal(false);
      setEditando(null);
      setShowOtroPlan(false);
      setForm(formVacio);
      setVehiculosDelCliente([]);
      cargarMensualidades();
      cargarPuestos();
    } catch (error) {
      mostrarToast(error.response?.data?.message || "Error al guardar mensualidad", "error");
    } finally { setCargando(false); }
  };

  const abrirEditar = (m) => {
    setForm({
      clienteId: m.clienteId?.toString() || "",
      vehiculoId: m.vehiculoId?.toString() || "",
      puestoId: m.puestoId?.toString() || "",
      planId: m.planId?.toString() || "",
      fechaInicio: m.fechaInicio ? new Date(m.fechaInicio).toISOString().split("T")[0] : "",
      fechaFin: m.fechaFin ? new Date(m.fechaFin).toISOString().split("T")[0] : "",
      valor: m.valor?.toString() || "",
      observacion: m.observacion || "",
    });
    setShowOtroPlan(!m.planId && !!m.observacion);
    setEditando(m);
    cargarVehiculosDelCliente(m.clienteId);
    setMostrarModal(true);
  };

  const confirmarRenovar = (id) => {
    setConfirm({ abierto: true, titulo: "Renovar mensualidad", mensaje: "¿Renovar esta mensualidad por un mes más?", onConfirm: () => renovar(id) });
  };

  const renovar = async (id) => {
    try {
      await api.put(`/mensualidades/renovar/${id}`);
      cargarMensualidades();
      mostrarToast("Suscripción renovada por un mes más", "success");
    } catch (error) { mostrarToast("Error al renovar mensualidad", "error"); }
  };

  const eliminarMensualidad = async () => {
    if (!eliminarId) return;
    try {
      await api.delete(`/mensualidades/${eliminarId}`);
      setEliminarId(null);
      cargarMensualidades();
      cargarPuestos();
      mostrarToast("Suscripción eliminada", "success");
    } catch (error) { mostrarToast(error.response?.data?.message || "Error al eliminar", "error"); }
  };

  const cobrarMensualidad = async () => {
    if (!cobrarId) return;
    setCargando(true);
    try {
      const body = { metodoPago };
      const montoNum = parseFloat(montoAbono);
      if (montoNum > 0) body.monto = montoNum;
      const res = await api.post(`/mensualidades/cobrar/${cobrarId}`, body);
      setCobrarId(null);
      setMetodoPago("efectivo");
      setMontoAbono("");
      setPagoExitoso(res.data);
      setCajaInfo(res.data.caja);
      cargarMensualidades();
    } catch (error) {
      const msg = error.response?.data?.message || "";
      if (msg.includes("Caja cerrada")) {
        setCargando(false);
        const opened = await requestAbrirCaja();
        if (opened) navigate("/caja");
      } else {
        mostrarToast(msg || "Error al registrar pago", "error");
      }
    }
    finally { setCargando(false); }
  };

  const cancelarMensualidad = async () => {
    if (!cancelarId) return;
    try {
      await api.put(`/mensualidades/cancelar/${cancelarId}`);
      setCancelarId(null);
      cargarMensualidades();
      cargarPuestos();
      mostrarToast("Suscripción cancelada", "success");
    } catch (error) { mostrarToast(error.response?.data?.message || "Error al cancelar", "error"); }
  };

  const hoy = new Date();
  const filtrados = mensualidades;

  const formatValor = (v) => formatCurrency(v);

  const enviarWhatsAppVencida = (telefono, nombre, placa, valor) => {
    if (!telefono) { mostrarToast("Cliente sin teléfono", "error"); return; }
    const mensaje = `Hola ${nombre}, te recordamos que tu mensualidad de ${formatCurrency(valor || 0)} para el vehículo ${placa} está vencida. Por favor acércate a pagar para evitar inconvenientes.`;
    window.open(`https://wa.me/57${telefono}?text=${encodeURIComponent(mensaje)}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-page dark:bg-slate-900 p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Suscripciones</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Planes de estacionamiento recurrente</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={filtrados.map(m => ({ Cliente: `${m.cliente?.nombres || ""} ${m.cliente?.apellidos || ""}`.trim(), Vehiculo: m.vehiculo?.placa || "—", Plan: m.observacion || m.plan?.nombre || "—", Puesto: m.puesto?.codigo || "—", Inicio: new Date(m.fechaInicio).toLocaleDateString("es-CO"), Fin: new Date(m.fechaFin).toLocaleDateString("es-CO"), Valor: `$${(m.valor || 0).toLocaleString()}`, Saldo: (m.saldoPendiente ?? m.valor) > 0 ? `$${((m.saldoPendiente ?? m.valor) || 0).toLocaleString()}` : "Al día", Estado: m.estado === "ACTIVA" && new Date(m.fechaFin) < new Date() ? "Vencida" : m.estado === "ACTIVA" ? "Activa" : m.estado === "CANCELADA" ? "Cancelada" : m.estado }))} filename="suscripciones" title="Suscripciones" columns={[{ key: 'Cliente', label: 'Cliente' }, { key: 'Vehiculo', label: 'Vehículo' }, { key: 'Plan', label: 'Plan' }, { key: 'Puesto', label: 'Puesto' }, { key: 'Inicio', label: 'Inicio' }, { key: 'Fin', label: 'Fin' }, { key: 'Valor', label: 'Valor' }, { key: 'Saldo', label: 'Saldo' }, { key: 'Estado', label: 'Estado' }]} />
          <button onClick={generarFacturas} disabled={generandoFacturas} className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-lg shadow-amber-600/20 disabled:opacity-50 active:scale-[0.98]">
            <RefreshCw className={`w-4 h-4 ${generandoFacturas ? "animate-spin" : ""}`} /> {generandoFacturas ? "Generando..." : "Generar facturas"}
          </button>
          <button onClick={() => { setForm(formVacio); setMostrarModal(true); }} className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-lg shadow-teal-600/20 active:scale-[0.98]">
            <IconPlus /> Nueva Suscripción
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex-1 min-w-[200px] bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center"><IconSearch /></div>
            <input type="text" placeholder="Buscar por cliente o placa..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" />
          </div>
        </div>
        <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-1">
          {[{ value: "", label: "Todas" }, { value: "ACTIVA", label: "Activas" }, { value: "VENCIDA", label: "Vencidas" }, { value: "CANCELADA", label: "Canceladas" }].map(t => (
            <button key={t.value} onClick={() => { setFiltroEstado(t.value); setPage(1); }} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${filtroEstado === t.value ? "bg-teal-600 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total", count: mensualidades.length, color: "text-slate-800 dark:text-white", bg: "bg-white dark:bg-slate-800" },
          { label: "Activas", count: mensualidades.filter(m => m.estado === "ACTIVA" && new Date(m.fechaFin) >= new Date()).length, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "Vencidas", count: mensualidades.filter(m => m.estado === "ACTIVA" && new Date(m.fechaFin) < new Date()).length, color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
          { label: "Al día", count: mensualidades.filter(m => m.estado === "ACTIVA" && (m.saldoPendiente ?? m.valor) <= 0).length, color: "text-teal-700 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-900/20" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {initialLoading ? <TableSkeleton rows={8} cols={11} /> : (
      <div className="rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800 dark:bg-slate-700">
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase">Cliente</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase">Vehículo</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase">Obs.</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase">Puesto</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase">Ausencia</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase">Inicio</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase">Fin</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase">Valor</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase">Saldo pendiente</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase">Estado</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtrados.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-16 text-center"><p className="text-slate-400 dark:text-slate-500 text-sm">No hay mensualidades registradas</p></td></tr>
              ) : (
                filtrados.map((m) => {
                  const fin = new Date(m.fechaFin);
                  const vencida = fin < hoy && m.estado === "ACTIVA";
                  const esActiva = m.estado === "ACTIVA" && !vencida;
                  return (
                    <tr key={m.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/50 ${vencida ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium text-slate-800 dark:text-white">{m.cliente?.nombres} {m.cliente?.apellidos}</p>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-400 font-mono">{m.vehiculo?.placa || "—"}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-400">{m.observacion || m.plan?.nombre || "—"}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-400 font-mono">
                        <div className="flex items-center gap-2">
                          <span>{m.puesto?.codigo || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {m.ausente ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 whitespace-nowrap">
                            Ausente
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-400">{new Date(m.fechaInicio).toLocaleDateString()}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-400">{new Date(m.fechaFin).toLocaleDateString()}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-white text-right">{formatValor(m.valor)}</td>
                      <td className="px-4 py-3.5 text-sm text-right">
                        {(m.saldoPendiente ?? m.valor) > 0 ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400">{formatValor(m.saldoPendiente ?? m.valor)}</span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Al día</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center"><EstadoMensualidadBadge estado={m.estado} vencida={vencida} /></td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {(m.saldoPendiente ?? m.valor) > 0 && m.estado === "ACTIVA" && (
                            <button onClick={() => { setCobrarId(m.id); setMontoAbono(String(m.saldoPendiente ?? m.valor)); setMetodoPago("efectivo"); setRecibidoMensualidad(""); }} className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Cobrar">
                              <IconCash />
                            </button>
                          )}
                          {vencida && m.cliente?.telefono && (
                            <button onClick={() => enviarWhatsAppVencida(m.cliente.telefono, `${m.cliente.nombres} ${m.cliente.apellidos}`, m.vehiculo?.placa, m.valor)} className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Enviar WhatsApp">
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => setMenuAbiertoId(menuAbiertoId === m.id ? null : m.id)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
<MoreVertical className="w-5 h-5" />
                         </button>
                         </div>
                       </td>
                     </tr>
                   );
                 })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={pagination.page || 1} totalPages={pagination.totalPages || 1} total={pagination.total || 0} onPageChange={setPage} />
      </div>
      )}

      <FormModal
        open={mostrarModal}
        onClose={() => { setMostrarModal(false); setEditando(null); setShowOtroPlan(false); setVehiculosDelCliente([]); }}
        gradient="from-purple-600 to-pink-500"
        icon={CalendarClock}
        titulo={editando ? "Editar Suscripción" : "Nueva Suscripción"}
        subtitulo={editando ? "Modifica los datos" : "Crea una suscripción recurrente"}
        footer={
          <>
            <button onClick={() => { setMostrarModal(false); setEditando(null); setShowOtroPlan(false); setVehiculosDelCliente([]); }} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600">Cancelar</button>
            <button onClick={guardarMensualidad} disabled={cargando || !form.clienteId || !form.vehiculoId} className={`px-5 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${editando ? 'bg-amber-600 hover:bg-amber-700' : 'bg-teal-600 hover:bg-teal-700'}`}>
              {cargando ? "Guardando..." : editando ? "Guardar Cambios" : "Crear Suscripción"}
            </button>
          </>
        }
      >
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
          <div>
            <label className={labelClass}>Cliente</label>
            {editando ? (
              <div className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700">{editando.cliente?.nombres} {editando.cliente?.apellidos}</div>
            ) : (
              <ClientSearch value={form.clienteId} onChange={(id) => { const val = id?.toString() || ""; setForm(p => ({ ...p, clienteId: val, vehiculoId: "" })); cargarVehiculosDelCliente(val); }} placeholder="Buscar cliente..." />
            )}
          </div>
          <div>
            <label className={labelClass}>Vehículo</label>
            <Select value={form.vehiculoId} onChange={(val) => handleChange({ target: { name: "vehiculoId", value: val } })} options={[
              { value: "", label: form.clienteId ? "Cargando vehículos..." : "Seleccionar cliente primero..." },
              ...vehiculosDelCliente.map(v => ({ value: String(v.id), label: `${v.placa} — ${v.marca} ${v.modelo}` })),
            ]} placeholder={form.clienteId ? "Cargando vehículos..." : "Seleccionar cliente primero..."} />
          </div>

          {/* Plan — selector tipo cuadrícula */}
          <div>
            <label className={labelClass}>Plan</label>
            {planes.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${!showOtroPlan && !form.planId ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400" : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-teal-300"}`}>
                  <input type="radio" name="planRadio" checked={!showOtroPlan && !form.planId} onChange={() => { setShowOtroPlan(false); setForm(p => ({ ...p, planId: "", valor: "", fechaFin: "" })); }} className="hidden" />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${!showOtroPlan && !form.planId ? "border-teal-500" : "border-slate-300 dark:border-slate-500"}`}>
                    {!showOtroPlan && !form.planId && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                  </div>
                  <span className="text-xs font-medium">Sin plan</span>
                </label>
                {planes.map(p => (
                  <label key={p.id} className={`flex flex-col gap-0.5 px-3 py-2 rounded-lg border cursor-pointer transition-all ${!showOtroPlan && form.planId === String(p.id) ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20" : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-teal-300"}`}>
                    <input type="radio" name="planRadio" checked={!showOtroPlan && form.planId === String(p.id)} onChange={() => {
                      setShowOtroPlan(false);
                      const inicio = form.fechaInicio || new Date().toISOString().split("T")[0];
                      const fin = new Date(new Date(inicio).getTime() + p.duracionDias * 86400000).toISOString().split("T")[0];
                      setForm(prev => ({ ...prev, planId: String(p.id), valor: p.valor.toString(), fechaFin: fin, observacion: "" }));
                    }} className="hidden" />
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${!showOtroPlan && form.planId === String(p.id) ? "border-teal-500" : "border-slate-300 dark:border-slate-500"}`}>
                        {!showOtroPlan && form.planId === String(p.id) && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                      </div>
                      <span className={`text-xs font-semibold ${!showOtroPlan && form.planId === String(p.id) ? "text-teal-700 dark:text-teal-300" : "text-slate-700 dark:text-slate-300"}`}>{p.nombre}</span>
                    </div>
                    <span className={`text-[11px] ml-6 ${!showOtroPlan && form.planId === String(p.id) ? "text-teal-600 dark:text-teal-400" : "text-slate-400 dark:text-slate-500"}`}>{p.duracionDias} días — {formatValor(p.valor)}</span>
                  </label>
                ))}
                <label className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${showOtroPlan ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400" : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-teal-300"}`}>
                  <input type="radio" name="planRadio" checked={showOtroPlan} onChange={() => { setShowOtroPlan(true); setForm(p => ({ ...p, planId: "", observacion: p.observacion || "" })); }} className="hidden" />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${showOtroPlan ? "border-teal-500" : "border-slate-300 dark:border-slate-500"}`}>
                    {showOtroPlan && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                  </div>
                  <span className="text-xs font-medium">Otro</span>
                </label>
              </div>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">No hay planes disponibles</p>
            )}
            {showOtroPlan && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input type="text" placeholder="Nombre del plan..." value={form.observacion || ""} onChange={(e) => setForm(p => ({ ...p, observacion: e.target.value }))} className={inputClass} autoFocus />
                <input type="number" min="1" placeholder="Días" value={form.duracionDias || ""} onChange={(e) => setForm(p => ({ ...p, duracionDias: e.target.value }))} className={inputClass} />
              </div>
            )}
          </div>

          {/* Puesto + Fechas + Valor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Puesto (opcional)</label>
              <Select value={form.puestoId} onChange={(val) => handleChange({ target: { name: "puestoId", value: val } })} options={[
                { value: "", label: "Sin asignar" },
                ...puestos.filter(p => p.estado === "LIBRE" || (editando && p.estado === "OCUPADO" && p.id === editando.puestoId)).map(p => ({ value: String(p.id), label: `${p.codigo} (${p.estado})` })),
              ]} placeholder="Sin asignar" />
            </div>
            <div>
              <label className={labelClass}>Valor ($)</label>
              <input name="valor" type="number" min="0" placeholder="0" value={form.valor} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Fecha inicio</label>
              <input name="fechaInicio" type="date" value={form.fechaInicio} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Fecha fin</label>
              <input name="fechaFin" type="date" value={form.fechaFin} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Observación</label>
            <textarea name="observacion" placeholder="Notas..." value={form.observacion} onChange={handleChange} className={inputClass + " resize-none"} rows={2} />
          </div>
        </div>
      </FormModal>

      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
      <ConfirmDialog abierto={confirm.abierto} titulo={confirm.titulo} mensaje={confirm.mensaje} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(c => ({ ...c, abierto: false }))} />
      <ConfirmDialog
        abierto={!!cancelarId}
        titulo="Cancelar mensualidad"
        mensaje="¿Estás seguro de cancelar esta mensualidad? El puesto quedará libre."
        onConfirm={cancelarMensualidad}
        onCancel={() => setCancelarId(null)}
      />
      {menuAbiertoId && (() => {
        const m = mensualidades.find(x => x.id === menuAbiertoId);
        if (!m) return null;
        const fin = new Date(m.fechaFin);
        const vencida = fin < hoy && m.estado === "ACTIVA";
        const esActiva = m.estado === "ACTIVA" && !vencida;
        return (
          <div className="fixed inset-0 z-50 flex justify-center items-center px-4">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMenuAbiertoId(null)} />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-modal-in">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 dark:from-slate-800 to-white dark:to-slate-800">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">{m.cliente?.nombres} {m.cliente?.apellidos}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{m.vehiculo?.placa}{m.plan?.nombre ? ` · ${m.plan.nombre}` : m.observacion ? ` · ${m.observacion}` : ""}</p>
                </div>
                <button onClick={() => setMenuAbiertoId(null)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400"><IconX /></button>
              </div>
              <div className="p-4 space-y-2">
                {(m.saldoPendiente ?? m.valor) > 0 ? (
                <button onClick={() => { setCobrarId(m.id); setMontoAbono(String(m.saldoPendiente ?? m.valor)); setMetodoPago("efectivo"); setRecibidoMensualidad(""); setMenuAbiertoId(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-medium text-sm transition-all">
                  <span className="p-2 rounded-lg bg-emerald-600 text-white"><IconCash /></span>
                  Cobrar mensualidad
                  <span className="ml-auto text-xs font-bold dark:text-emerald-400">{formatValor(m.valor)}</span>
                </button>
                ) : (
                <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-medium text-sm">
                  <span className="p-2 rounded-lg bg-slate-400 text-white"><IconCash /></span>
                  Al día — sin saldo pendiente
                </div>
                )}
                {esActiva && (
                  <>
                    <button onClick={() => { confirmarRenovar(m.id); setMenuAbiertoId(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 font-medium text-sm transition-all">
                      <span className="p-2 rounded-lg bg-teal-600 text-white"><IconRefresh /></span>
                      Renovar por 1 mes
                    </button>
                    <button onClick={() => { setCancelarId(m.id); setMenuAbiertoId(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-medium text-sm transition-all">
                      <span className="p-2 rounded-lg bg-amber-600 text-white"><IconXCircle /></span>
                      Cancelar mensualidad
                    </button>
                  </>
                )}
                {vencida && m.cliente?.telefono && (
                  <button onClick={() => { enviarWhatsAppVencida(m.cliente.telefono, `${m.cliente.nombres} ${m.cliente.apellidos}`, m.vehiculo?.placa, m.valor); setMenuAbiertoId(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-medium text-sm transition-all">
                    <span className="p-2 rounded-lg bg-emerald-600 text-white">
                      <MessageCircle className="w-4 h-4" />
                    </span>
                    Enviar WhatsApp
                  </button>
                )}
                <button onClick={() => { abrirEditar(m); setMenuAbiertoId(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 font-medium text-sm transition-all">
                  <span className="p-2 rounded-lg bg-blue-600 text-white"><IconEdit /></span>
                  Editar datos
                </button>
                <button onClick={() => { setEliminarId(m.id); setMenuAbiertoId(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 font-medium text-sm transition-all">
                  <span className="p-2 rounded-lg bg-red-600 text-white"><IconTrash /></span>
                  Eliminar mensualidad
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {(() => {
        const m = cobrarId ? mensualidades.find(mm => mm.id === cobrarId) : null;
        const saldo = m ? (m.saldoPendiente ?? m.valor) : 0;
        return cobrarId && (
        <FormModal
          key="modal-cobrar"
          open={!!cobrarId}
          onClose={() => { setCobrarId(null); setMetodoPago("efectivo"); setMontoAbono(""); setRecibidoMensualidad(""); }}
          gradient="from-emerald-600 to-teal-500"
          icon={Wallet}
          titulo="Cobrar Suscripción"
          subtitulo="Registra el pago y genera factura"
          footer={
            <>
              <button onClick={() => { setCobrarId(null); setMetodoPago("efectivo"); setMontoAbono(""); setRecibidoMensualidad(""); }} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">Cancelar</button>
              <button onClick={cobrarMensualidad} disabled={cargando} className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {cargando ? "Procesando..." : "Confirmar Pago"}
              </button>
            </>
          }
        >
          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Valor mensualidad:</span>
              <span className="text-lg font-bold text-slate-800 dark:text-white">{formatValor(m?.valor || 0)}</span>
            </div>
            {saldo > 0 && saldo < (m?.valor || 0) && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex justify-between items-center">
                <span className="text-sm text-amber-700 dark:text-amber-400">Saldo pendiente:</span>
                <span className="text-lg font-bold text-amber-700 dark:text-amber-400">{formatValor(saldo)}</span>
              </div>
            )}
            <div>
              <label className={labelClass}>Monto a pagar</label>
              <input
                type="number" min="0.01" step="0.01"
                value={montoAbono}
                onChange={(e) => setMontoAbono(e.target.value)}
                className={inputClass}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Puedes modificar el monto si es un abono parcial</p>
            </div>
            <SelectWithOther
              label="Método de pago"
              name="metodoPago"
              value={metodoPago}
              onChange={(e) => { setMetodoPago(e.target.value); setRecibidoMensualidad(""); }}
              options={getMetodosPagoActivos(config).map(m => ({ value: m.key, label: m.label }))}
              otherLabel="Otro"
            />

            {metodoPago === "efectivo" && parseFloat(montoAbono || 0) > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 space-y-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Calculo de Vuelto</p>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Total a cobrar:</span>
                  <span className="font-bold dark:text-white">${parseFloat(montoAbono).toLocaleString()}</span>
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Recibi ($)</label>
                  <input type="number" min="0" value={recibidoMensualidad} onChange={(e) => setRecibidoMensualidad(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" placeholder="0" />
                </div>
                {parseFloat(recibidoMensualidad || 0) > 0 && (
                  <div className={`flex justify-between text-sm font-bold ${parseFloat(recibidoMensualidad) < parseFloat(montoAbono) ? 'text-red-600' : 'text-emerald-700'}`}>
                    {parseFloat(recibidoMensualidad) >= parseFloat(montoAbono) ? (
                      <><span>Vuelto:</span><span>${(parseFloat(recibidoMensualidad) - parseFloat(montoAbono)).toLocaleString()}</span></>
                    ) : (
                      <><span>Faltan:</span><span>${(parseFloat(montoAbono) - parseFloat(recibidoMensualidad)).toLocaleString()}</span></>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </FormModal>
        );
      })()}

      <FormModal
        open={!!pagoExitoso}
        onClose={() => setPagoExitoso(null)}
        gradient="from-emerald-600 to-teal-500"
        icon={CheckCircle}
        titulo={pagoExitoso?.renovada ? "Suscripción renovada" : "Abono registrado"}
        size="max-w-md"
        footer={
          <div className="flex gap-3 w-full">
            <button onClick={() => setPagoExitoso(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer">Seguir en Suscripciones</button>
            <button onClick={() => { setPagoExitoso(null); navigate("/caja"); }} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 cursor-pointer">Ir a Caja</button>
          </div>
        }
      >
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Factura <strong className="dark:text-white">{pagoExitoso?.factura?.numero}</strong></p>
          <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 space-y-2 text-sm text-left">
            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Valor pagado:</span><span className="font-bold text-emerald-700 dark:text-emerald-400">{formatValor(pagoExitoso?.factura?.valor)}</span></div>
            {pagoExitoso?.saldoPendiente > 0 && (
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-600 pt-2"><span className="text-amber-700 dark:text-amber-400 font-medium">Saldo pendiente:</span><span className="font-bold text-amber-700 dark:text-amber-400">{formatValor(pagoExitoso.saldoPendiente)}</span></div>
            )}
          </div>
          {pagoExitoso?.renovada && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">Suscripción renovada por 1 mes</p>
          )}
          {cajaInfo && (
            <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 space-y-1.5 text-sm text-left">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Caja actual</p>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Ingresos acumulados:</span><span className="font-medium text-slate-800 dark:text-white">{formatValor(cajaInfo.ingresosAcumulado)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Saldo actual:</span><span className="font-bold text-emerald-700 dark:text-emerald-400">{formatValor(cajaInfo.saldo)}</span></div>
            </div>
          )}
        </div>
      </FormModal>

      <ConfirmDialog
        abierto={!!eliminarId}
        titulo="Eliminar mensualidad"
        mensaje="¿Estás seguro de eliminar esta mensualidad? Esta acción no se puede deshacer."
        onConfirm={eliminarMensualidad}
        onCancel={() => setEliminarId(null)}
      />
      <ScrollLock cuando={mostrarModal || !!menuAbiertoId || !!pagoExitoso} />
    </div>
  );
}

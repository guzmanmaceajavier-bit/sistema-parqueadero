import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { CalendarCheck, Info, Plus } from "lucide-react";
import ClientSearch from "../components/ClientSearch";
import VehicleSearch from "../components/VehicleSearch";
import api from "../services/api";
import Select from "../components/ui/Select";
import Pagination from "../components/Pagination";
import Toast from "../components/Toast";
import FormModal from "../components/ui/FormModal";
import ExportButton from "../components/ExportButton";
import ConfirmDialog from "../components/ConfirmDialog";
import { TableSkeleton } from "../components/Skeleton";

const ESTADOS = [
  { value: "PENDIENTE", label: "Pendiente", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500" },
  { value: "CONFIRMADA", label: "Confirmada", bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800", dot: "bg-blue-500" },
  { value: "ACTIVA", label: "Activa", bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" },
  { value: "FINALIZADA", label: "Finalizada", bg: "bg-slate-100 dark:bg-slate-700", text: "text-slate-600 dark:text-slate-300", border: "border-slate-300 dark:border-slate-600", dot: "bg-slate-400" },
  { value: "CANCELADA", label: "Cancelada", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800", dot: "bg-red-500" },
  { value: "NO_SHOW", label: "No Show", bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800", dot: "bg-rose-500" },
];

function EstadoBadge({ estado }) {
  const config = ESTADOS.find(e => e.value === estado) || ESTADOS[0];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";
const btnClass = "px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

export default function Reservas() {
  const location = useLocation();
  const [reservas, setReservas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const mostrarToast = useCallback((mensaje, tipo = "success") => setToast({ mensaje, tipo }), []);
  const [editando, setEditando] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [form, setForm] = useState({
    clienteId: null, vehiculoId: null, puestoId: null, fechaInicio: "", fechaFin: "", observaciones: "",
  });
  const [confirmDeleteReserva, setConfirmDeleteReserva] = useState(null);
  const [showNewVec, setShowNewVec] = useState(false);
  const [newVecForm, setNewVecForm] = useState({ placa: "", marca: "", modelo: "", color: "" });
  const [loadingNewVec, setLoadingNewVec] = useState(false);

  const cargarDatos = async () => {
    try {
      const [resReservas, resClientes, resVehiculos, resPuestos] = await Promise.all([
        api.get("/reservas", { params: { page, estado: filtroEstado || undefined, q: search.trim() || undefined } }),
        api.get("/clientes"),
        api.get("/vehiculos"),
        api.get("/puestos"),
      ]);
      setReservas(resReservas.data.reservas || []);
      setPagination(resReservas.data.pagination || {});
      setClientes(resClientes.data.clientes || []);
      setVehiculos(resVehiculos.data.vehiculos || []);
      setPuestos(resPuestos.data.puestos || []);
    } catch (error) {
      console.error(error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarDatos(); }, [page, filtroEstado, search]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const resetForm = () => {
    setForm({ clienteId: null, vehiculoId: null, puestoId: null, fechaInicio: "", fechaFin: "", observaciones: "" });
    setEditando(null);
  };

  useEffect(() => {
    if (location.state?.puestoId) {
      resetForm();
      setDetalle(null);
      setForm(prev => ({ ...prev, puestoId: location.state.puestoId }));
      setShowModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const openNew = () => {
    resetForm();
    setDetalle(null);
    setShowModal(true);
  };

  const openEdit = (r) => {
    setEditando(r);
    setForm({
      clienteId: r.clienteId ?? null, vehiculoId: r.vehiculoId ?? null, puestoId: r.puestoId ?? null,
      fechaInicio: r.fechaInicio ? r.fechaInicio.slice(0, 16) : "",
      fechaFin: r.fechaFin ? r.fechaFin.slice(0, 16) : "",
      observaciones: r.observaciones || "",
    });
    setShowModal(true);
    setDetalle(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editando) {
        await api.put(`/reservas/${editando.id}`, form);
        mostrarToast("Reserva actualizada", "success");
      } else {
        await api.post("/reservas", form);
        mostrarToast("Reserva creada", "success");
      }
      setShowModal(false);
      resetForm();
      cargarDatos();
    } catch (error) {
      mostrarToast(error.response?.data?.message || "Error al guardar reserva", "error");
    }
  };

  const handleCambiarEstado = async (id, estado) => {
    try {
      const res = await api.put(`/reservas/${id}/estado`, { estado });
      cargarDatos();
      setDetalle(res.data.reserva);
      mostrarToast(`Estado cambiado a "${ESTADOS.find(e => e.value === estado)?.label}"`, "success");
    } catch (error) {
      mostrarToast(error.response?.data?.message || "Error al cambiar estado", "error");
    }
  };

  const handleEliminar = async (id) => {
    try {
      await api.delete(`/reservas/${id}`);
      cargarDatos();
      setDetalle(null);
      mostrarToast("Reserva eliminada", "success");
    } catch (error) {
      mostrarToast(error.response?.data?.message || "Error al eliminar reserva", "error");
    }
  };

  const handleCancelar = async (id) => {
    try {
      await api.put(`/reservas/cancelar/${id}`);
      cargarDatos();
      setDetalle(prev => prev && prev.id === id ? { ...prev, estado: "CANCELADA" } : prev);
      mostrarToast("Reserva cancelada", "success");
    } catch (error) {
      mostrarToast(error.response?.data?.message || "Error al cancelar reserva", "error");
    }
  };

  const handleNewVehiculo = async () => {
    if (!newVecForm.placa.trim()) { mostrarToast("La placa es requerida", "error"); return; }
    setLoadingNewVec(true);
    try {
      const res = await api.post("/vehiculos", newVecForm);
      const v = res.data.vehiculo || res.data;
      setVehiculos(prev => [v, ...prev]);
      setForm(prev => ({ ...prev, vehiculoId: v.id }));
      setShowNewVec(false);
      setNewVecForm({ placa: "", marca: "", modelo: "", color: "" });
      mostrarToast("Vehículo creado", "success");
    } catch (err) {
      mostrarToast(err.response?.data?.message || "Error al crear vehículo", "error");
    } finally { setLoadingNewVec(false); }
  };

  const formatFecha = (f) => f ? new Date(f).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h12" }) : "-";

  const [config, setConfig] = useState({ nombreParqueadero: "ParkAdmin" });

  useEffect(() => {
    api.get("/configuracion").then(r => setConfig(r.data.config || r.data || { nombreParqueadero: "ParkAdmin" })).catch(() => {});
  }, []);

  const enviarWhatsApp = (telefono, nombre, placa, puesto, fechaInicio, fechaFin) => {
    if (!telefono) { mostrarToast("Cliente sin teléfono", "error"); return; }
    const hora = new Date().getHours();
    const saludo = hora < 12 ? "Buenos d\u00edas" : hora < 18 ? "Buenas tardes" : "Buenas noches";
    const parqueadero = config?.nombreParqueadero || "ParkAdmin";
    const inicio = fechaInicio ? new Date(fechaInicio).toLocaleString("es-CO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h12" }) : "";
    const fin = fechaFin ? new Date(fechaFin).toLocaleString("es-CO", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h12" }) : "no definida";
    const lineas = [
      `${saludo}, ${nombre}.`,
      ``,
      `Reciba un cordial saludo de ${parqueadero}.`,
      `Le informamos que su reserva ha sido asignada de la siguiente manera:`,
      ``,
      `\u{1F697} Veh\u00edculo: ${placa || "No asignado"}`,
      `\u{1F6CD} Puesto: ${puesto || "Pendiente de asignaci\u00f3n"}`,
      `\u{1F4C5} Inicio: ${inicio}`,
      `\u{1F4C5} Fin: ${fin}`,
      ``,
      `Agradecemos su preferencia.`,
      `${parqueadero}`,
    ];
    window.open(`https://wa.me/57${telefono}?text=${encodeURIComponent(lineas.join("\n"))}`, "_blank");
  };

  if (cargando) return <TableSkeleton rows={8} cols={6} />;

  return (
    <div className="space-y-6 dark:bg-slate-900 min-h-screen p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
            Reservas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gestión de reservas de puestos</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={reservas.map(r => ({ Cliente: `${r.cliente?.nombres || ""} ${r.cliente?.apellidos || ""}`.trim(), Vehiculo: r.vehiculo?.placa || "-", Puesto: r.puesto?.codigo || "-", Inicio: r.fechaInicio ? new Date(r.fechaInicio).toLocaleString("es-CO") : "", Fin: r.fechaFin ? new Date(r.fechaFin).toLocaleString("es-CO") : "", Estado: r.estado }))} filename="reservas" title="Reservas" columns={[{ key: 'Cliente', label: 'Cliente' }, { key: 'Vehiculo', label: 'Vehículo' }, { key: 'Puesto', label: 'Puesto' }, { key: 'Inicio', label: 'Inicio' }, { key: 'Fin', label: 'Fin' }, { key: 'Estado', label: 'Estado' }]} />
          <button onClick={openNew} className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20 cursor-pointer">+ Nueva Reserva</button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar cliente, placa o puesto..." className={`${inputClass} pl-10`} />
          <svg className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
        </div>
        <Select value={filtroEstado} onChange={val => setFiltroEstado(val)} options={[
          { value: "", label: "Todos los estados" },
          ...ESTADOS.map(e => ({ value: e.value, label: e.label })),
        ]} className="max-w-xs" />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 dark:bg-slate-700">
              <tr>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Cliente</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Vehículo</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Puesto</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Inicio</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Estado</th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {reservas.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800 dark:text-white">{r.cliente?.nombres} {r.cliente?.apellidos}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {r.vehiculo ? <><span className="font-medium">{r.vehiculo.placa}</span><span className="text-xs text-slate-400 dark:text-slate-500 ml-1">{`${r.vehiculo.marca || ""} ${r.vehiculo.tipo || ""}`}</span></> : <span className="text-slate-400 dark:text-slate-500 italic">-</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.puesto?.codigo || <span className="text-slate-400 dark:text-slate-500 italic">-</span>}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatFecha(r.fechaInicio)}</td>
                  <td className="px-4 py-3"><EstadoBadge estado={r.estado} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setDetalle(r)} className={`${btnClass} border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 hover:border-slate-300 dark:hover:border-slate-500`}>
                      <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
              {reservas.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500">No hay reservas registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={pagination.page || 1} totalPages={pagination.totalPages || 1} total={pagination.total || 0} onPageChange={setPage} />
      </div>

      <FormModal
        open={!!detalle}
        onClose={() => setDetalle(null)}
        gradient="from-violet-600 to-purple-500"
        icon={Info}
        titulo={`Reserva #${detalle?.id || ""}`}
        footer={
          <div className="flex flex-wrap items-center gap-2 w-full">
            {detalle?.estado === "PENDIENTE" && !detalle?.puestoId && (
              <button onClick={() => { const r = detalle; setDetalle(null); openEdit(r); }} className={`${btnClass} bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20`}>
                Asignar puesto
              </button>
            )}
            {detalle?.estado === "PENDIENTE" && (
              <button onClick={() => handleCambiarEstado(detalle.id, "CONFIRMADA")} className={`${btnClass} bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20`}>
                Confirmar reserva
              </button>
            )}
            {detalle?.estado === "CONFIRMADA" && (
              <button onClick={() => handleCambiarEstado(detalle.id, "ACTIVA")} className={`${btnClass} bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20`}>
                Activar ingreso
              </button>
            )}
            {detalle?.estado === "ACTIVA" && (
              <button onClick={() => handleCambiarEstado(detalle.id, "FINALIZADA")} className={`${btnClass} bg-slate-600 hover:bg-slate-700 text-white shadow-lg shadow-slate-600/20`}>
                Finalizar reserva
              </button>
            )}
            {["PENDIENTE", "CONFIRMADA"].includes(detalle?.estado) && (
              <button onClick={() => openEdit(detalle)} className={`${btnClass} border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600`}>
                Editar
              </button>
            )}
            {["PENDIENTE", "CONFIRMADA"].includes(detalle?.estado) && (
              <button onClick={() => handleCancelar(detalle.id)} className={`${btnClass} border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20`}>
                Cancelar
              </button>
            )}
            {["PENDIENTE", "CANCELADA", "NO_SHOW", "FINALIZADA"].includes(detalle?.estado) && (
              <button onClick={() => setConfirmDeleteReserva(detalle.id)} className={`${btnClass} border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}>
                Eliminar
              </button>
            )}
            <button onClick={() => setDetalle(null)} className={`${btnClass} border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 ml-auto`}>
              Cerrar
            </button>
          </div>
        }
      >
        {detalle && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <EstadoBadge estado={detalle.estado} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cliente</span>
                <p className="text-sm font-medium text-slate-800 dark:text-white mt-1">{detalle.cliente?.nombres} {detalle.cliente?.apellidos}</p>
                {detalle.cliente?.documento && <p className="text-xs text-slate-500 dark:text-slate-400">{`Doc: ${detalle.cliente.documento}`}</p>}
                {detalle.cliente?.telefono && (
                  <button onClick={() => enviarWhatsApp(detalle.cliente.telefono, `${detalle.cliente.nombres} ${detalle.cliente.apellidos}`, detalle.vehiculo?.placa, detalle.puesto?.codigo, detalle.fechaInicio, detalle.fechaFin)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Enviar WhatsApp
                  </button>
                )}
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Vehículo</span>
                {detalle.vehiculo ? (
                  <>
                    <p className="text-sm font-medium text-slate-800 dark:text-white mt-1">{detalle.vehiculo.placa}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{`${detalle.vehiculo.marca} ${detalle.vehiculo.modelo}${detalle.vehiculo.color ? ` - ${detalle.vehiculo.color}` : ""}`}</p>
                    {detalle.vehiculo.tipo && <span className="inline-block mt-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{detalle.vehiculo.tipo}</span>}
                  </>
                ) : <p className="text-sm text-slate-400 dark:text-slate-500 italic mt-1">Sin asignar</p>}
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Puesto</span>
                {detalle.puesto ? (
                  <>
                    <p className="text-sm font-medium text-slate-800 dark:text-white mt-1">{detalle.puesto.codigo}</p>
                    <span className={`inline-block mt-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${detalle.puesto.estado === "RESERVADO" ? "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" : detalle.puesto.estado === "OCUPADO" ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400" : "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"}`}>{detalle.puesto.estado}</span>
                  </>
                ) : <p className="text-sm text-slate-400 dark:text-slate-500 italic mt-1">Sin asignar</p>}
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Fechas</span>
                <p className="text-sm font-medium text-slate-800 dark:text-white mt-1">{`Inicio: ${formatFecha(detalle.fechaInicio)}`}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{detalle.fechaFin ? `Fin: ${formatFecha(detalle.fechaFin)}` : <span className="text-slate-400 dark:text-slate-500 italic">Sin definir</span>}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{`Creada: ${formatFecha(detalle.createdAt)}`}</p>
              </div>
            </div>

            {detalle.observaciones && (
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Observaciones</span>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{detalle.observaciones}</p>
              </div>
            )}
          </div>
        )}
      </FormModal>

      <FormModal
        open={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        gradient="from-rose-600 to-pink-500"
        icon={CalendarCheck}
        titulo={editando ? "Editar Reserva" : "Nueva Reserva"}
        subtitulo="Registra una reserva de puesto para un cliente"
        footer={
          <>
            <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className={`${btnClass} border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600`}>Cancelar</button>
            <button type="submit" form="form-reserva" className={`${btnClass} bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20`}>{editando ? "Guardar Cambios" : "Crear Reserva"}</button>
          </>
        }
      >
        <form id="form-reserva" onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
            {editando ? (
              <div>
                <label className={labelClass}>Cliente</label>
                <p className="text-sm font-medium text-slate-800 dark:text-white px-3 py-2.5 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">{editando.cliente?.nombres} {editando.cliente?.apellidos}</p>
              </div>
            ) : (
              <div>
                <label className={labelClass}>Cliente</label>
                <ClientSearch value={form.clienteId} onChange={(id) => setForm({ ...form, clienteId: id || null })} placeholder="Buscar cliente..." />
              </div>
            )}
            <div>
              <label className={labelClass}>Vehículo</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <VehicleSearch value={form.vehiculoId} onChange={(id) => setForm({ ...form, vehiculoId: id || null })} placeholder="Buscar vehículo..." />
                </div>
                <button type="button" onClick={() => setShowNewVec(true)} className="shrink-0 px-3 py-2.5 rounded-lg text-sm font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-all cursor-pointer">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Puesto</label>
              <Select value={form.puestoId ?? ""} onChange={(val) => setForm({ ...form, puestoId: val ? Number(val) : null })} options={[
                { value: "", label: "Sin asignar" },
                ...puestos.filter(p => p.activo && (p.estado === "LIBRE" || (editando && p.id === editando.puestoId))).map(p => ({ value: String(p.id), label: `${p.codigo}${p.estado !== "LIBRE" ? ` (${p.estado})` : ""}` })),
              ]} />
            </div>
            <div>
              <label className={labelClass}>Fecha y hora de inicio</label>
              <input type="datetime-local" name="fechaInicio" value={form.fechaInicio} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Fecha y hora de fin <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span></label>
              <input type="datetime-local" name="fechaFin" value={form.fechaFin} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Observaciones</label>
              <textarea name="observaciones" value={form.observaciones} onChange={handleChange} className={inputClass} rows={3} />
            </div>
          </div>
        </form>
      </FormModal>

      <ConfirmDialog abierto={!!confirmDeleteReserva} titulo="Eliminar reserva" mensaje="¿Estás seguro de eliminar esta reserva?" onConfirm={() => handleEliminar(confirmDeleteReserva)} onCancel={() => setConfirmDeleteReserva(null)} />
      {showNewVec && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={() => setShowNewVec(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4">Nuevo Vehículo</h3>
            <div className="space-y-3" onKeyDown={e => { if (e.key === "Enter" && !loadingNewVec) handleNewVehiculo(); }}>
              <input placeholder="Placa *" value={newVecForm.placa} onChange={e => setNewVecForm({ ...newVecForm, placa: e.target.value.toUpperCase() })} className={inputClass} style={{ textTransform: "uppercase" }} autoFocus />
              <input placeholder="Marca" value={newVecForm.marca} onChange={e => setNewVecForm({ ...newVecForm, marca: e.target.value })} className={inputClass} />
              <input placeholder="Modelo" value={newVecForm.modelo} onChange={e => setNewVecForm({ ...newVecForm, modelo: e.target.value })} className={inputClass} />
              <input placeholder="Color" value={newVecForm.color} onChange={e => setNewVecForm({ ...newVecForm, color: e.target.value })} className={inputClass} />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNewVec(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer">Cancelar</button>
                <button type="button" onClick={handleNewVehiculo} disabled={loadingNewVec} className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20 disabled:opacity-50 cursor-pointer">{loadingNewVec ? "Guardando..." : "Guardar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
    </div>
  );
}
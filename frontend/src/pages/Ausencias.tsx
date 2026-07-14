import { useEffect, useState, useCallback } from "react";
import { Clock } from "lucide-react";
import ClientSearch from "../components/ClientSearch";
import api from "../services/api";
import Pagination from "../components/Pagination";
import Toast from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import Select from "../components/ui/Select";
import FormModal from "../components/ui/FormModal";
import ExportButton from "../components/ExportButton";

const ESTADOS = [
  { value: "ACTIVA", label: "Activa", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500" },
  { value: "FINALIZADA", label: "Finalizada", bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" },
];

const OPCIONES_AUSENCIA = [
  { value: "EXTENDER", label: "Extender vencimiento", desc: "Extiende la fecha fin de la mensualidad", color: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" },
  { value: "DESCONTAR", label: "Descontar días", desc: "Descuenta del valor de la mensualidad", color: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" },
  { value: "CONGELAR", label: "Congelar mensualidad", desc: "Pausa la mensualidad y extiende fecha fin", color: "bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400" },
  { value: "MANTENER", label: "Mantener cobro normal", desc: "El cliente sigue pagando normal", color: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" },
  { value: "HISTORIAL", label: "Solo historial", desc: "Solo se registra, sin cambios en mensualidad", color: "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300" },
];

function OpcionBadge({ opcion }) {
  const cfg = OPCIONES_AUSENCIA.find(o => o.value === opcion) || OPCIONES_AUSENCIA[4];
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color}`}>{cfg.label}</span>;
}

function EstadoBadge({ estado }) {
  const config = ESTADOS.find(e => e.value === estado) || ESTADOS[0];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function IconAusencia() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";
const btnClass = "px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

export default function Ausencias() {
  const [ausencias, setAusencias] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const mostrarToast = useCallback((mensaje, tipo = "success") => setToast({ mensaje, tipo }), []);
  const [confirm, setConfirm] = useState({ abierto: false, titulo: "", mensaje: "", onConfirm: () => {} });
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    clienteId: "", vehiculoId: "", fechaSalida: "", fechaRegreso: "", motivo: "", opcion: "HISTORIAL",
  });

  const cargarDatos = async () => {
    try {
      const [resAusencias, resClientes, resVehiculos] = await Promise.all([
        api.get("/ausencias", { params: { page, estado: filtroEstado || undefined, q: search.trim() || undefined } }),
        api.get("/clientes"),
        api.get("/vehiculos"),
      ]);
      setAusencias(resAusencias.data.ausencias || []);
      setPagination(resAusencias.data.pagination || {});
      setClientes(resClientes.data.clientes || []);
      setVehiculos(resVehiculos.data.vehiculos || []);
    } catch (error) {
      console.error(error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarDatos(); }, [page, filtroEstado, search]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const resetForm = () => {
    setForm({ clienteId: "", vehiculoId: "", fechaSalida: "", fechaRegreso: "", motivo: "", opcion: "HISTORIAL" });
    setEditando(null);
  };

  const openNew = () => { resetForm(); setShowModal(true); };

  const openEdit = (a) => {
    setEditando(a);
    setForm({
      clienteId: a.clienteId, vehiculoId: a.vehiculoId,
      fechaSalida: a.fechaSalida ? a.fechaSalida.slice(0, 16) : "",
      fechaRegreso: a.fechaRegreso ? a.fechaRegreso.slice(0, 16) : "",
      motivo: a.motivo || "",
      opcion: a.opcion || "HISTORIAL",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editando) {
        await api.put(`/ausencias/${editando.id}`, form);
      } else {
        await api.post("/ausencias", form);
      }
      setShowModal(false);
      resetForm();
      cargarDatos();
      mostrarToast(editando ? "Ausencia actualizada" : "Ausencia registrada", "success");
    } catch (error) {
      mostrarToast(error.response?.data?.message || "Error al guardar ausencia", "error");
    }
  };

  const handleFinalizar = async (id) => {
    try {
      const res = await api.put(`/ausencias/finalizar/${id}`);
      cargarDatos();
      mostrarToast(res.data?.mensaje || "Ausencia finalizada", "success");
    } catch (error) {
      mostrarToast(error.response?.data?.message || "Error al finalizar ausencia", "error");
    }
  };

  const handleDelete = async () => {
    const id = confirm.id;
    if (!id) return;
    try {
      await api.delete(`/ausencias/${id}`);
      setConfirm(c => ({ ...c, abierto: false }));
      cargarDatos();
      mostrarToast("Ausencia eliminada", "success");
    } catch (error) {
      mostrarToast(error.response?.data?.message || "Error al eliminar ausencia", "error");
    }
  };

  const confirmarEliminar = (id) => {
    setConfirm({ abierto: true, id, titulo: "Eliminar ausencia", mensaje: "¿Estás seguro de eliminar esta ausencia?", onConfirm: handleDelete });
  };

  const enviarWhatsApp = (telefono, nombre, placa) => {
    if (!telefono) { mostrarToast("Cliente sin teléfono", "error"); return; }
    const mensaje = `Hola ${nombre}, te informamos que registramos tu ausencia en el parqueadero. Si necesitas más información, contáctanos.`;
    window.open(`https://wa.me/57${telefono}?text=${encodeURIComponent(mensaje)}`, "_blank");
  };

  const formatFecha = (f) => f ? new Date(f).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h12" }) : "-";

  const calcDias = (a) => {
    const salida = new Date(a.fechaSalida);
    const regreso = a.fechaRegreso ? new Date(a.fechaRegreso) : new Date();
    if (isNaN(salida.getTime())) return "-";
    return Math.max(1, Math.ceil((regreso - salida) / 86400000));
  };

  if (cargando) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full dark:border-teal-400" /></div>;

  return (
    <div className="space-y-6 dark:bg-slate-900 min-h-screen p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><IconAusencia /> Ausencias</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Registro de ausencias de clientes</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={ausencias.map(a => ({ Cliente: `${a.cliente?.nombres || ""} ${a.cliente?.apellidos || ""}`.trim(), Vehiculo: a.vehiculo?.placa || "", "Fecha Salida": a.fechaSalida ? new Date(a.fechaSalida).toLocaleString("es-CO") : "", "Fecha Regreso": a.fechaRegreso ? new Date(a.fechaRegreso).toLocaleString("es-CO") : "", Días: calcDias(a), Motivo: a.motivo || "", Opción: OPCIONES_AUSENCIA.find(o => o.value === a.opcion)?.label || a.opcion || "Historial", Estado: a.estado === "ACTIVA" ? "Activa" : "Finalizada" }))} filename="ausencias" title="Ausencias" columns={[{ key: 'Cliente', label: 'Cliente' }, { key: 'Vehiculo', label: 'Vehículo' }, { key: 'Fecha Salida', label: 'Fecha Salida' }, { key: 'Fecha Regreso', label: 'Fecha Regreso' }, { key: 'Días', label: 'Días' }, { key: 'Motivo', label: 'Motivo' }, { key: 'Opción', label: 'Opción' }, { key: 'Estado', label: 'Estado' }]} />
          <button onClick={openNew} className={`${btnClass} bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20`}>+ Nueva Ausencia</button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar cliente, placa o motivo..." className={`${inputClass} pl-10`} />
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
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Salida</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Regreso</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Días</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Motivo</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Opción</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Estado</th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {ausencias.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800 dark:text-white">{a.cliente?.nombres} {a.cliente?.apellidos}</span>
                        {a.cliente?.telefono && (
                          <button onClick={() => enviarWhatsApp(a.cliente.telefono, `${a.cliente.nombres} ${a.cliente.apellidos}`, a.vehiculo?.placa)} className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Enviar WhatsApp">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{a.vehiculo?.placa}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatFecha(a.fechaSalida)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatFecha(a.fechaRegreso)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${a.estado === "ACTIVA" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                      {calcDias(a)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{a.motivo || "-"}</td>
                  <td className="px-4 py-3"><OpcionBadge opcion={a.opcion} /></td>
                  <td className="px-4 py-3"><EstadoBadge estado={a.estado} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {a.estado === "ACTIVA" && (
                          <>
                            <button onClick={() => openEdit(a)} className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Editar"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg></button>
                            <button onClick={() => handleFinalizar(a.id)} className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Finalizar"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" /></svg></button>
                          </>
                        )}
                        <button onClick={() => confirmarEliminar(a.id)} className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Eliminar"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></button>
                      </div>
                    </td>
                </tr>
              ))}
              {ausencias.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400 dark:text-slate-500">No hay ausencias registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={pagination.page || 1} totalPages={pagination.totalPages || 1} total={pagination.total || 0} onPageChange={setPage} />
      </div>

      <FormModal
        open={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        gradient="from-orange-600 to-red-500"
        icon={Clock}
        titulo={editando ? "Editar Ausencia" : "Nueva Ausencia"}
        subtitulo="Registra la ausencia de un cliente"
        footer={
          <>
            <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className={`${btnClass} border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600`}>Cancelar</button>
            <button type="submit" form="form-ausencia" className={`${btnClass} bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20`}>{editando ? "Guardar Cambios" : "Crear Ausencia"}</button>
          </>
        }
      >
        <form id="form-ausencia" onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
            <div>
              <label className={labelClass}>Cliente</label>
              <ClientSearch value={form.clienteId} onChange={(id) => setForm({ ...form, clienteId: id?.toString() || "" })} placeholder="Buscar cliente..." />
            </div>
            <div>
              <label className={labelClass}>Vehículo</label>
              <Select value={form.vehiculoId} onChange={(val) => handleChange({ target: { name: "vehiculoId", value: val } })} options={[
                { value: "", label: "Seleccionar vehículo..." },
                ...vehiculos.map(v => ({ value: String(v.id), label: `${v.placa}${v.marca ? ` - ${v.marca}` : ""}` })),
              ]} placeholder="Seleccionar vehículo..." />
            </div>
            <div>
              <label className={labelClass}>Fecha y hora de salida</label>
              <input type="datetime-local" name="fechaSalida" value={form.fechaSalida} onChange={handleChange} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Fecha y hora de regreso <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span></label>
              <input type="datetime-local" name="fechaRegreso" value={form.fechaRegreso} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Motivo</label>
              <textarea name="motivo" value={form.motivo} onChange={handleChange} className={inputClass} rows={3} placeholder="Ej: Viaje de negocios, vacaciones..." />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
            <div>
              <label className={labelClass}>Acción sobre el pago</label>
              <div className="grid grid-cols-1 gap-2">
                {OPCIONES_AUSENCIA.map(o => (
                  <label key={o.value} onClick={() => setForm({ ...form, opcion: o.value })}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.opcion === o.value ? "border-teal-500 dark:border-teal-600 bg-teal-50 dark:bg-teal-900/20" : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"}`}>
                    <input type="radio" name="opcion" value={o.value} checked={form.opcion === o.value} onChange={() => {}} className="mt-0.5 accent-teal-600" />
                    <div>
                      <span className={`text-sm font-semibold ${form.opcion === o.value ? "text-teal-700 dark:text-teal-400" : "text-slate-700 dark:text-slate-300"}`}>{o.label}</span>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{o.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </form>
      </FormModal>

      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
      <ConfirmDialog abierto={confirm.abierto} titulo={confirm.titulo} mensaje={confirm.mensaje} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(c => ({ ...c, abierto: false }))} />
    </div>
  );
}

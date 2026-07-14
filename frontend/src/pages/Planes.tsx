import { useEffect, useState, useCallback } from "react";
import { Crown, Plus, X, Edit3, Trash2, Receipt, Search } from "lucide-react";
import FormModal from "../components/ui/FormModal";
import useDebounce from "../hooks/useDebounce";
import api from "../services/api";
import { formatCurrency } from "../utils/formatters";
import Toast from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination from "../components/Pagination";
import ExportButton from "../components/ExportButton";

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";

const TIPOS_PLAN = [
  { value: "diario", label: "Plan Diario", dias: 1 },
  { value: "semanal", label: "Plan Semanal", dias: 7 },
  { value: "quincenal", label: "Plan Quincenal", dias: 15 },
  { value: "mensual", label: "Plan Mensual", dias: 30 },
];

const TIPOS_VEHICULO_CHECKBOX = [
  { value: "moto", label: "Moto" },
  { value: "carro", label: "Carro" },
  { value: "camioneta", label: "Camioneta" },
  { value: "bicicleta", label: "Bicicleta" },
];

function parseTipos(tipoVehiculo) {
  if (!tipoVehiculo) return [];
  return tipoVehiculo.split(",").map(t => t.trim()).filter(Boolean);
}

function formatTipos(lista) {
  if (lista.length === 0 || lista.includes("todos")) return "todos";
  return lista.join(",");
}

function displayTipos(tipoVehiculo) {
  if (!tipoVehiculo || tipoVehiculo === "todos") return "Todos los vehículos";
  return parseTipos(tipoVehiculo).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", ");
}

export default function Planes() {
  const [planes, setPlanes] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editarId, setEditarId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const [confirm, setConfirm] = useState({ abierto: false, titulo: "", mensaje: "", onConfirm: () => {} });
  const mostrarToast = useCallback((mensaje, tipo = "success") => setToast({ mensaje, tipo }), []);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const busquedaDebounced = useDebounce(busqueda);

  const formVacio = { nombre: "", descripcion: "", duracionDias: "", valor: "", tipoVehiculo: "todos" };
  const [form, setForm] = useState(formVacio);
  const [tiposSeleccionados, setTiposSeleccionados] = useState([]);
  const [tipoPlan, setTipoPlan] = useState("");
  const [mostrarOtroPlan, setMostrarOtroPlan] = useState(false);
  const [otroPlanTexto, setOtroPlanTexto] = useState("");
  const [mostrarOtroVeh, setMostrarOtroVeh] = useState(false);
  const [otroVehTexto, setOtroVehTexto] = useState("");

  function combinarTiposVeh(presets, custom) {
    const full = [...presets, ...(custom.trim() ? [custom.trim()] : [])];
    return full.length > 0 ? full.join(",") : "todos";
  }

  function actualizarTipoVeh(presets, custom) {
    const val = combinarTiposVeh(presets, custom);
    setForm(p => ({ ...p, tipoVehiculo: val }));
  }

  const seleccionarTipoPlan = (value) => {
    setTipoPlan(value);
    setMostrarOtroPlan(false);
    setOtroPlanTexto("");
    if (value === "otro") {
      setMostrarOtroPlan(true);
      setForm(p => ({ ...p, duracionDias: "" }));
      return;
    }
    const opt = TIPOS_PLAN.find(t => t.value === value);
    if (opt) {
      setForm(p => ({ ...p, nombre: opt.label, duracionDias: opt.dias.toString() }));
    }
  };

  const handleOtroPlanInput = (val) => {
    setOtroPlanTexto(val);
    setForm(p => ({ ...p, nombre: val }));
  };

  const handleTipoChange = (value) => {
    if (value === "todos") {
      setTiposSeleccionados([]);
      setMostrarOtroVeh(false);
      setOtroVehTexto("");
      actualizarTipoVeh([], "");
      return;
    }
    const nuevos = tiposSeleccionados.includes(value)
      ? tiposSeleccionados.filter(t => t !== value)
      : [...tiposSeleccionados, value];
    if (nuevos.length === 0) {
      setTiposSeleccionados([]);
      setMostrarOtroVeh(false);
      setOtroVehTexto("");
      actualizarTipoVeh([], "");
    } else {
      setTiposSeleccionados(nuevos);
      actualizarTipoVeh(nuevos, mostrarOtroVeh ? otroVehTexto : "");
    }
  };

  const handleOtroVehCheck = () => {
    if (mostrarOtroVeh) {
      setMostrarOtroVeh(false);
      setOtroVehTexto("");
      actualizarTipoVeh(tiposSeleccionados, "");
    } else {
      setMostrarOtroVeh(true);
    }
  };

  const handleOtroVehInput = (val) => {
    setOtroVehTexto(val);
    actualizarTipoVeh(tiposSeleccionados, val);
  };

  const cargarPlanes = async (p = 1) => {
    try {
      const params = { page: p };
      if (busqueda) params.q = busqueda;
      const res = await api.get("/planes", { params });
      setPlanes(res.data.planes || []);
      setPagination(res.data.pagination || {});
    } catch { console.log("error"); }
  };

  useEffect(() => { cargarPlanes(page); }, [page]);
  useEffect(() => { cargarPlanes(1); }, [busquedaDebounced]);

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const abrirNuevo = () => {
    setEditarId(null);
    setForm(formVacio);
    setTiposSeleccionados([]);
    setTipoPlan("");
    setMostrarOtroPlan(false);
    setOtroPlanTexto("");
    setMostrarOtroVeh(false);
    setOtroVehTexto("");
    setMostrarModal(true);
  };

  const abrirEditar = (p) => {
    setEditarId(p.id);
    const tipos = parseTipos(p.tipoVehiculo);
    const predef = TIPOS_VEHICULO_CHECKBOX.map(t => t.value);
    const presets = tipos.filter(t => predef.includes(t));
    const custom = tipos.filter(t => !predef.includes(t)).join(", ");
    setTiposSeleccionados(presets);
    setMostrarOtroVeh(!!custom);
    setOtroVehTexto(custom);

    const planPreset = TIPOS_PLAN.find(t => t.dias === p.duracionDias && t.label === p.nombre);
    if (planPreset) {
      setTipoPlan(planPreset.value);
      setMostrarOtroPlan(false);
      setOtroPlanTexto("");
    } else {
      setTipoPlan("otro");
      setMostrarOtroPlan(true);
      setOtroPlanTexto(p.nombre);
    }

    setForm({ nombre: p.nombre, descripcion: p.descripcion || "", duracionDias: p.duracionDias.toString(), valor: p.valor.toString(), tipoVehiculo: p.tipoVehiculo || "todos" });
    setMostrarModal(true);
  };

  const guardarPlan = async () => {
    setCargando(true);
    try {
      const payload = { ...form, duracionDias: parseInt(form.duracionDias), valor: parseFloat(form.valor) };
      if (editarId) {
        await api.put(`/planes/${editarId}`, payload);
      } else {
        await api.post("/planes", payload);
      }
      setMostrarModal(false);
      cargarPlanes();
      mostrarToast(editarId ? "Plan actualizado" : "Plan creado", "success");
    } catch (error) {
      mostrarToast(error.response?.data?.message || "Error al guardar plan", "error");
    } finally { setCargando(false); }
  };

  const eliminarPlan = async (id) => {
    try { await api.delete(`/planes/${id}`); cargarPlanes(); mostrarToast("Plan eliminado", "success"); } catch { mostrarToast("Error al eliminar", "error"); }
  };

  const confirmarEliminar = (id) => {
    setConfirm({ abierto: true, titulo: "Eliminar plan", mensaje: "¿Estás seguro de eliminar este plan?", onConfirm: () => eliminarPlan(id) });
  };

  const toggleActivo = async (p) => {
    try { await api.put(`/planes/${p.id}`, { activo: !p.activo }); cargarPlanes(); mostrarToast(p.activo ? "Plan desactivado" : "Plan activado", "success"); } catch { mostrarToast("Error al cambiar estado", "error"); }
  };

  const formatValor = (v) => formatCurrency(v);

  const labelPlan = (v) => TIPOS_PLAN.find(t => t.value === v)?.label || v;

  return (
    <div className="min-h-screen bg-page dark:bg-slate-900 p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Planes</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Configura los planes de suscripción periódica</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={planes.map(p => ({ Nombre: p.nombre, Descripcion: p.descripcion || "", Duracion: `${p.duracionDias} día(s)`, Valor: `$${(p.valor || 0).toLocaleString()}`, Tipo: displayTipos(p.tipoVehiculo), Activo: p.activo ? "Sí" : "No" }))} filename="planes" title="Planes" columns={[{ key: 'Nombre', label: 'Nombre' }, { key: 'Descripcion', label: 'Descripción' }, { key: 'Duracion', label: 'Duración' }, { key: 'Valor', label: 'Valor' }, { key: 'Tipo', label: 'Tipo' }, { key: 'Activo', label: 'Activo' }]} />
          <button onClick={abrirNuevo} className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-lg shadow-teal-600/20">
            <IconPlus /> Nuevo Plan
          </button>
        </div>
      </div>

      <div className="p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 dark:bg-slate-800 mb-5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </div>
          <input type="text" placeholder="Buscar planes..." value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500" />
        </div>
      </div>

      {planes.length === 0 ? (
        <div className="rounded-xl border border-slate-100 dark:border-slate-700 dark:bg-slate-800 p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <IconPlan />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No hay planes configurados</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Crea tu primer plan para empezar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {planes.map((p) => (
            <div key={p.id} className={`bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${p.activo ? "border-slate-100 dark:border-slate-700" : "border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10"}`}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">{p.nombre}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{displayTipos(p.tipoVehiculo)}</p>
                  </div>
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${p.activo ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"}`}>
                    {p.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>
                {p.descripcion && <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{p.descripcion}</p>}
                <div className="flex items-end gap-2 mb-4">
                  <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">{formatValor(p.valor)}</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mb-1">/ {p.duracionDias} días</p>
                </div>
              </div>
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-700 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
                <button onClick={() => abrirEditar(p)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 border border-teal-200 dark:border-teal-800 rounded-lg">
                  <IconEdit /> Editar
                </button>
                <button onClick={() => toggleActivo(p)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${p.activo ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 border-amber-200 dark:border-amber-800" : "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800"}`}>
                  {p.activo ? "Desactivar" : "Activar"}
                </button>
                <button onClick={() => confirmarEliminar(p.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg">
                  <IconTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <FormModal
        open={mostrarModal}
        onClose={() => setMostrarModal(false)}
        gradient="from-amber-600 to-orange-500"
        icon={Crown}
        titulo={editarId ? "Editar Plan" : "Nuevo Plan"}
        footer={
          <>
            <button onClick={() => setMostrarModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">Cancelar</button>
            <button onClick={guardarPlan} disabled={cargando} className="px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
              {cargando ? "Guardando..." : editarId ? "Guardar Cambios" : "Crear Plan"}
            </button>
          </>
        }
      >
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
          {/* Tipo de vehículo */}
          <div>
            <label className={labelClass}>Tipo de vehículo</label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={tiposSeleccionados.length === 0 && !mostrarOtroVeh} onChange={() => handleTipoChange("todos")} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500/20 cursor-pointer" />
                <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">Todos los tipos</span>
              </label>
              <hr className="border-slate-100 dark:border-slate-700" />
              {TIPOS_VEHICULO_CHECKBOX.map(t => (
                <label key={t.value} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={tiposSeleccionados.includes(t.value)} onChange={() => handleTipoChange(t.value)} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500/20 cursor-pointer" />
                  <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">{t.label}</span>
                </label>
              ))}
              <hr className="border-slate-100 dark:border-slate-700" />
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={mostrarOtroVeh} onChange={handleOtroVehCheck} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500/20 cursor-pointer" />
                <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">Otro</span>
              </label>
              {mostrarOtroVeh && (
                <input type="text" value={otroVehTexto} onChange={(e) => handleOtroVehInput(e.target.value)}
                  placeholder="Especificar tipo..."
                  className="mt-1 ml-6 w-[calc(100%-24px)] px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white dark:bg-slate-700" autoFocus />
              )}
            </div>
          </div>

          {/* Tipo de plan */}
          <div>
            <label className={labelClass}>Tipo de plan</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TIPOS_PLAN.map(t => (
                <label key={t.value}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                    tipoPlan === t.value
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400"
                      : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-teal-300"
                  }`}>
                  <input type="radio" name="tipoPlan" checked={tipoPlan === t.value}
                    onChange={() => seleccionarTipoPlan(t.value)} className="hidden" />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    tipoPlan === t.value ? "border-teal-500" : "border-slate-300 dark:border-slate-500"
                  }`}>
                    {tipoPlan === t.value && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                  </div>
                  <span className="text-xs font-medium">{t.label}</span>
                </label>
              ))}
              <label
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                  tipoPlan === "otro"
                    ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400"
                    : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-teal-300"
                }`}>
                <input type="radio" name="tipoPlan" checked={tipoPlan === "otro"}
                  onChange={() => seleccionarTipoPlan("otro")} className="hidden" />
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  tipoPlan === "otro" ? "border-teal-500" : "border-slate-300 dark:border-slate-500"
                }`}>
                  {tipoPlan === "otro" && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                </div>
                <span className="text-xs font-medium">Otro</span>
              </label>
            </div>
            {mostrarOtroPlan && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input type="text" value={otroPlanTexto} onChange={(e) => handleOtroPlanInput(e.target.value)}
                  placeholder="Nombre del plan..." className={inputClass} autoFocus />
                <input name="duracionDias" type="number" min="1" placeholder="Días"
                  value={form.duracionDias} onChange={handleChange} className={inputClass} />
              </div>
            )}
          </div>

          {/* Nombre (readonly) / Duración */}
          {tipoPlan !== "otro" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nombre</label>
                <div className="px-3 py-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300">
                  {form.nombre || "Selecciona un tipo"}
                </div>
              </div>
              <div>
                <label className={labelClass}>Duración</label>
                <div className="px-3 py-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300">
                  {form.duracionDias ? `${form.duracionDias} día(s)` : "—"}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Descripción</label>
            <textarea name="descripcion" placeholder="Beneficios y detalles del plan..." value={form.descripcion} onChange={handleChange} className={inputClass + " resize-none"} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Valor ($) *</label>
              <input name="valor" type="number" min="0" placeholder="100000" value={form.valor} onChange={handleChange} className={inputClass} />
            </div>
          </div>

        </div>
      </FormModal>

      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
      <ConfirmDialog abierto={confirm.abierto} titulo={confirm.titulo} mensaje={confirm.mensaje} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(c => ({ ...c, abierto: false }))} />
    </div>
  );
}

function IconPlan() {
  return <Receipt className="w-4 h-4" />;
}
function IconPlus() {
  return <Plus className="w-5 h-5" />;
}
function IconX() {
  return <X className="w-5 h-5" />;
}
function IconEdit() {
  return <Edit3 className="w-4 h-4" />;
}
function IconTrash() {
  return <Trash2 className="w-4 h-4" />;
}

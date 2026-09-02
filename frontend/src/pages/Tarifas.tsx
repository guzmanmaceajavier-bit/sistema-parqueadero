import { useEffect, useState, useCallback } from "react";
import { DollarSign, Plus, Search, X, Edit3, Trash2 } from "lucide-react";
import FormModal from "../components/ui/FormModal";
import useDebounce from "../hooks/useDebounce";
import api from "../services/api";
import Pagination from "../components/Pagination";
import { formatCurrency } from "../utils/formatters";
import Toast from "../components/Toast";
import ScrollLock from "../components/ScrollLock";
import ExportButton from "../components/ExportButton";
import ConfirmDialog from "../components/ConfirmDialog";
import { useListas } from "../context/ListasContext";
import { TableSkeleton } from "../components/Skeleton";

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";

const TIPOS_VEHICULO_CHECKBOX = [];

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

const MODALIDADES = [
  { value: "hora", label: "Por hora", desc: "1 hora", duracion: 1, unidad: "hora" },
  { value: "diario", label: "Diario", desc: "1 día", duracion: 1, unidad: "día" },
  { value: "semanal", label: "Semanal", desc: "7 días", duracion: 7, unidad: "día" },
  { value: "quincenal", label: "Quincenal", desc: "15 días", duracion: 15, unidad: "día" },
  { value: "mensual", label: "Mensual", desc: "30 días", duracion: 30, unidad: "día" },
];

function IconDollar() {
  return <DollarSign className="w-4 h-4" />;
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

function IconEdit() {
  return <Edit3 className="w-4 h-4" />;
}

function IconTrash() {
  return <Trash2 className="w-4 h-4" />;
}

function ModalidadBadge({ modalidad }) {
  const colors = {
    minuto: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
    hora: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    diario: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    semanal: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    quincenal: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    mensual: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    personalizado: "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600",
  };
  const label = MODALIDADES.find(m => m.value === modalidad)?.label || modalidad;
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${colors[modalidad] || colors.hora}`}>
      {label}
    </span>
  );
}

export default function Tarifas() {
  const { listas } = useListas();
  const [tarifas, setTarifas] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const busquedaDebounced = useDebounce(busqueda);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [tarifaId, setTarifaId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const mostrarToast = useCallback((mensaje, tipo = "success") => setToast({ mensaje, tipo }), []);
  const [initialLoading, setInitialLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const formVacio = { nombre: "", tipoVehiculo: "todos", modalidad: "hora", valor: "", minutosCortesia: "0", descripcion: "", duracion: "", precioPrimeraHora: "", precioHoraAdicional: "", tarifaMaximaDiaria: "", minutosGratis: "0" };
  const [form, setForm] = useState(formVacio);
  const [tiposSeleccionados, setTiposSeleccionados] = useState([]);
  const [mostrarOtro, setMostrarOtro] = useState(false);
  const [otroTexto, setOtroTexto] = useState("");
  const [mostrarOtraModal, setMostrarOtraModal] = useState(false);
  const [otraModalTexto, setOtraModalTexto] = useState("");

  function combinarTipos(presets, custom) {
    const full = [...presets, ...(custom.trim() ? [custom.trim()] : [])];
    return full.length > 0 ? full.join(",") : "todos";
  }

  function generarNombre(tipoVal) {
    const modalLabel = MODALIDADES.find(m => m.value === form.modalidad)?.label || form.modalidad;
    const tipoLabel = displayTipos(tipoVal);
    return `${tipoLabel} — ${modalLabel}`;
  }

  const actualizar = useCallback((presets, custom, modal) => {
    const tipoVal = combinarTipos(presets, custom);
    const modalLabel = MODALIDADES.find(m => m.value === modal)?.label || modal;
    const tipoLabel = displayTipos(tipoVal);
    setForm(p => ({ ...p, tipoVehiculo: tipoVal, nombre: `${tipoLabel} — ${modalLabel}` }));
  }, []);

  const handleTipoChange = (value) => {
    if (value === "todos") {
      setTiposSeleccionados([]);
      setMostrarOtro(false);
      setOtroTexto("");
      actualizar([], "", form.modalidad);
      return;
    }
    const nuevos = tiposSeleccionados.includes(value)
      ? tiposSeleccionados.filter(t => t !== value)
      : [...tiposSeleccionados, value];
    if (nuevos.length === 0) {
      setTiposSeleccionados([]);
      setMostrarOtro(false);
      setOtroTexto("");
      actualizar([], "", form.modalidad);
    } else {
      setTiposSeleccionados(nuevos);
      actualizar(nuevos, mostrarOtro ? otroTexto : "", form.modalidad);
    }
  };

  const handleOtroCheck = () => {
    if (mostrarOtro) {
      setMostrarOtro(false);
      setOtroTexto("");
      actualizar(tiposSeleccionados, "", form.modalidad);
    } else {
      setMostrarOtro(true);
    }
  };

  const handleOtroInput = (val) => {
    setOtroTexto(val);
    actualizar(tiposSeleccionados, val, form.modalidad);
  };

  const handleModalidadChange = (e) => {
    const modal = e.target.value;
    const presets = mostrarOtro ? tiposSeleccionados : tiposSeleccionados;
    const custom = mostrarOtro ? otroTexto : "";
    const tipoVal = combinarTipos(presets, custom);
    const modalLabel = MODALIDADES.find(m => m.value === modal)?.label || modal;
    const tipoLabel = displayTipos(tipoVal);
    setForm(p => ({ ...p, modalidad: modal, nombre: `${tipoLabel} — ${modalLabel}` }));
  };

  const seleccionarModalidad = (value) => {
    setMostrarOtraModal(false);
    setOtraModalTexto("");
    if (value === "otro") {
      setMostrarOtraModal(true);
      return;
    }
    handleModalidadChange({ target: { value } });
  };

  const handleOtraModalInput = (val) => {
    setOtraModalTexto(val);
    if (val.trim()) {
      const presets = mostrarOtro ? tiposSeleccionados : tiposSeleccionados;
      const custom = mostrarOtro ? otroTexto : "";
      const tipoVal = combinarTipos(presets, custom);
      const tipoLabel = displayTipos(tipoVal);
      setForm(p => ({ ...p, modalidad: val.trim(), nombre: `${tipoLabel} — ${val.trim()}` }));
    }
  };

  const cargarTarifas = async (p = 1) => {
    try {
      const params = { page: p };
      if (busqueda) params.q = busqueda;
      const res = await api.get("/tarifas", { params });
      setTarifas(res.data.tarifas || []);
      setPagination(res.data.pagination || {});
    } catch (error) { console.log(error); }
    finally { setInitialLoading(false); }
  };

  useEffect(() => { cargarTarifas(page); }, [page]);
  useEffect(() => { cargarTarifas(1); }, [busquedaDebounced]);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const guardarTarifa = async () => {
    setCargando(true);
    try {
      const { duracion: _d, ...resto } = form;
      const payload = {
        ...resto,
        valor: parseFloat(resto.valor),
        minutosCortesia: parseInt(resto.minutosCortesia) || 0,
        precioPrimeraHora: resto.precioPrimeraHora ? parseFloat(resto.precioPrimeraHora) : null,
        precioHoraAdicional: resto.precioHoraAdicional ? parseFloat(resto.precioHoraAdicional) : null,
        tarifaMaximaDiaria: resto.tarifaMaximaDiaria ? parseFloat(resto.tarifaMaximaDiaria) : null,
        minutosGratis: parseInt(resto.minutosGratis) || 0,
      };
      if (modoEdicion) {
        await api.put(`/tarifas/${tarifaId}`, payload);
      } else {
        await api.post("/tarifas", payload);
      }
      setMostrarModal(false);
      setForm(formVacio);
      setTiposSeleccionados([]);
      setMostrarOtro(false);
      setOtroTexto("");
      setMostrarOtraModal(false);
      setOtraModalTexto("");
      cargarTarifas();
      mostrarToast(modoEdicion ? "Precio actualizado" : "Precio creado", "success");
    } catch (error) {
      mostrarToast("Error al guardar precio", "error");
    } finally { setCargando(false); }
  };

  const editarTarifa = (tarifa) => {
    setModoEdicion(true);
    setTarifaId(tarifa.id);
    const tipos = parseTipos(tarifa.tipoVehiculo);
    const predef = listas.tiposVehiculo.map(t => t.value);
    const presets = tipos.filter(t => predef.includes(t));
    const custom = tipos.filter(t => !predef.includes(t)).join(", ");
    setTiposSeleccionados(presets);
    setMostrarOtro(!!custom);
    setOtroTexto(custom);
    const modalPreset = MODALIDADES.find(m => m.value === tarifa.modalidad);
    setMostrarOtraModal(!modalPreset);
    setOtraModalTexto(modalPreset ? "" : tarifa.modalidad || "");
    setForm({
      nombre: tarifa.nombre || "",
      tipoVehiculo: tarifa.tipoVehiculo || "todos",
      modalidad: tarifa.modalidad || "hora",
      valor: tarifa.valor?.toString() || "",
      minutosCortesia: tarifa.minutosCortesia?.toString() || "0",
      descripcion: tarifa.descripcion || "",
      duracion: modalPreset ? modalPreset.duracion.toString() : "",
      precioPrimeraHora: tarifa.precioPrimeraHora?.toString() || "",
      precioHoraAdicional: tarifa.precioHoraAdicional?.toString() || "",
      tarifaMaximaDiaria: tarifa.tarifaMaximaDiaria?.toString() || "",
      minutosGratis: tarifa.minutosGratis?.toString() || "0",
    });
    setMostrarModal(true);
  };

  const eliminarTarifa = async (id) => {
    try {
      await api.delete(`/tarifas/${id}`);
      cargarTarifas();
      mostrarToast("Precio eliminado", "success");
    } catch { mostrarToast("Error al eliminar", "error"); }
  };

  const abrirNuevo = () => {
    setModoEdicion(false);
    setTarifaId(null);
    setForm(formVacio);
    setTiposSeleccionados([]);
    setMostrarOtro(false);
    setOtroTexto("");
    setMostrarOtraModal(false);
    setOtraModalTexto("");
    setMostrarModal(true);
  };

  const formatValor = (v) => formatCurrency(v);

  return (
    <div className="min-h-screen bg-page dark:bg-slate-900 p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Precios por Tiempo</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Configura los precios por tipo de vehículo y modalidad</p>
        </div>
        <div className="flex gap-3">
          <ExportButton data={tarifas.map(t => ({ Nombre: t.nombre, Tipo: displayTipos(t.tipoVehiculo), Modalidad: (t.modalidad || "").charAt(0).toUpperCase() + (t.modalidad || "").slice(1), Valor: `$${(t.valor || 0).toLocaleString()}`, Cortesia: `${t.minutosCortesia || 0} min` }))} filename="precios-por-tiempo" title="Precios por Tiempo" columns={[{ key: 'Nombre', label: 'Nombre' }, { key: 'Tipo', label: 'Tipo' }, { key: 'Modalidad', label: 'Modalidad' }, { key: 'Valor', label: 'Valor' }, { key: 'Cortesia', label: 'Cortesía' }]} />
          <button onClick={abrirNuevo} className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 shadow-lg shadow-teal-600/20 active:scale-[0.98]">
            <IconPlus /> Nuevo Precio
          </button>
        </div>
      </div>

      <div className="p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 dark:bg-slate-800 mb-5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><IconSearch /></div>
          <input type="text" placeholder="Buscar precios..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500" />
        </div>
      </div>

      {initialLoading ? <TableSkeleton rows={8} cols={5} /> : (
      <>
      {tarifas.length === 0 ? (
        <div className="rounded-xl border border-slate-100 dark:border-slate-700 dark:bg-slate-800 p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <IconDollar />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No hay precios configurados</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Crea tu primer precio para empezar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tarifas.map((tarifa) => (
            <div key={tarifa.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden transition-all hover:shadow-md">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">{tarifa.nombre}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{displayTipos(tarifa.tipoVehiculo)}</p>
                  </div>
                  <ModalidadBadge modalidad={tarifa.modalidad} />
                </div>
                {tarifa.descripcion && <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{tarifa.descripcion}</p>}
                <div className="flex items-end gap-2 mb-1">
                  <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">{formatValor(tarifa.valor)}</p>
                </div>
                {tarifa.precioPrimeraHora != null && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">Progresiva: 1ª hra ${tarifa.precioPrimeraHora.toLocaleString()} + adic ${tarifa.precioHoraAdicional?.toLocaleString()}/hra</p>
                )}
                {tarifa.tarifaMaximaDiaria && (
                  <p className="text-xs text-purple-600 dark:text-purple-400">Máx diaria: ${tarifa.tarifaMaximaDiaria.toLocaleString()}</p>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500">{tarifa.minutosCortesia || 0} min cortesía · {tarifa.minutosGratis || 0} min gratis</p>
              </div>
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-700 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
                <button onClick={() => editarTarifa(tarifa)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 border border-teal-200 dark:border-teal-800 rounded-lg">
                  <IconEdit /> Editar
                </button>
                <button onClick={() => setConfirmDelete(tarifa.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg">
                  <IconTrash /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={pagination.page || 1} totalPages={pagination.totalPages || 1} total={pagination.total || 0} onPageChange={setPage} />
      </>
      )}

      <FormModal
        open={mostrarModal}
        onClose={() => setMostrarModal(false)}
        gradient="from-blue-600 to-indigo-500"
        icon={DollarSign}
        titulo={modoEdicion ? "Editar Precio" : "Nuevo Precio"}
        subtitulo="Configura el precio y modalidad"
        footer={
          <>
            <button onClick={() => setMostrarModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600">Cancelar</button>
            <button onClick={guardarTarifa} disabled={cargando} className="px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
              {cargando ? "Guardando..." : "Guardar Precio"}
            </button>
          </>
        }
      >
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
          <div>
            <label className={labelClass}>Tipo de vehículo</label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={tiposSeleccionados.length === 0 && !mostrarOtro} onChange={() => handleTipoChange("todos")} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500/20 cursor-pointer" />
                <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">Todos los tipos</span>
              </label>
              <hr className="border-slate-100 dark:border-slate-700" />
              {listas.tiposVehiculo.map(t => (
                <label key={t.value} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={tiposSeleccionados.includes(t.value)} onChange={() => handleTipoChange(t.value)} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500/20 cursor-pointer" />
                  <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">{t.label}</span>
                </label>
              ))}
              <hr className="border-slate-100 dark:border-slate-700" />
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={mostrarOtro} onChange={handleOtroCheck} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500/20 cursor-pointer" />
                <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">Otro</span>
              </label>
              {mostrarOtro && (
                <input type="text" value={otroTexto} onChange={(e) => handleOtroInput(e.target.value)}
                  placeholder="Especificar tipo..."
                  className="mt-1 ml-6 w-[calc(100%-24px)] px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white dark:bg-slate-700" autoFocus />
              )}
            </div>
          </div>
          {/* Modalidad */}
          <div>
            <label className={labelClass}>Modalidad</label>
            <div className="grid grid-cols-3 gap-2">
              {MODALIDADES.map(m => (
                <label key={m.value}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                    form.modalidad === m.value && !mostrarOtraModal
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400"
                      : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-teal-300"
                  }`}>
                  <input type="radio" name="modalRadio" checked={form.modalidad === m.value && !mostrarOtraModal}
                    onChange={() => seleccionarModalidad(m.value)} className="hidden" />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    form.modalidad === m.value && !mostrarOtraModal ? "border-teal-500" : "border-slate-300 dark:border-slate-500"
                  }`}>
                    {form.modalidad === m.value && !mostrarOtraModal && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                  </div>
                  <span className="text-xs font-medium">{m.label}</span>
                </label>
              ))}
              <label
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                  mostrarOtraModal
                    ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400"
                    : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-teal-300"
                }`}>
                <input type="radio" name="modalRadio" checked={mostrarOtraModal}
                  onChange={() => seleccionarModalidad("otro")} className="hidden" />
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  mostrarOtraModal ? "border-teal-500" : "border-slate-300 dark:border-slate-500"
                }`}>
                  {mostrarOtraModal && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                </div>
                <span className="text-xs font-medium">Otra</span>
              </label>
            </div>
            {mostrarOtraModal && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input type="text" value={otraModalTexto} onChange={(e) => handleOtraModalInput(e.target.value)}
                  placeholder="Nombre de la modalidad..." className={inputClass} autoFocus />
                <input name="duracion" type="number" min="1" placeholder="Días"
                  value={form.duracion || ""} onChange={(e) => setForm(p => ({ ...p, duracion: parseInt(e.target.value) || "" }))} className={inputClass} />
              </div>
            )}
          </div>
          {/* Nombre + Duración (solo para modalidades predefinidas) */}
          {!mostrarOtraModal && form.modalidad && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nombre</label>
                <div className="px-3 py-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300">
                  {form.nombre || "—"}
                </div>
              </div>
              <div>
                <label className={labelClass}>Duración</label>
                <div className="px-3 py-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300">
                  {(() => {
                    const m = MODALIDADES.find(x => x.value === form.modalidad);
                    return m ? `${m.duracion} ${m.unidad}(s)` : "—";
                  })()}
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Valor ($)</label>
              <input name="valor" type="number" min="0" placeholder="0" value={form.valor} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Minutos de cortesía</label>
              <input name="minutosCortesia" type="number" min="0" placeholder="0" value={form.minutosCortesia} onChange={handleChange} className={inputClass} />
            </div>
          </div>

          {/* Tarifas progresivas */}
          <div className="border-t border-slate-200 dark:border-slate-600 pt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Tarifas progresivas (opcional)</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Si se configuran, reemplazan el cálculo por valor fijo para la modalidad por hora</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Precio primera hora ($)</label>
                <input name="precioPrimeraHora" type="number" min="0" placeholder="—" value={form.precioPrimeraHora} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Precio hora adicional ($)</label>
                <input name="precioHoraAdicional" type="number" min="0" placeholder="—" value={form.precioHoraAdicional} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Tarifa máxima diaria ($)</label>
                <input name="tarifaMaximaDiaria" type="number" min="0" placeholder="—" value={form.tarifaMaximaDiaria} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Minutos gratis</label>
                <input name="minutosGratis" type="number" min="0" placeholder="0" value={form.minutosGratis} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>
          <div>
            <label className={labelClass}>Descripción (opcional)</label>
            <textarea name="descripcion" placeholder="Notas adicionales..." value={form.descripcion} onChange={handleChange} className={inputClass + " resize-none"} rows={2} />
          </div>
        </div>
      </FormModal>
      <ConfirmDialog abierto={!!confirmDelete} titulo="Eliminar precio" mensaje="¿Estás seguro de eliminar este precio?" onConfirm={() => eliminarTarifa(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
      <ScrollLock cuando={mostrarModal} />
    </div>
  );
}

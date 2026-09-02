import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, Plus, Search, X, Edit3, Trash2, RefreshCw } from "lucide-react";
import FormModal from "../components/ui/FormModal";
import useDebounce from "../hooks/useDebounce";
import ScrollLock from "../components/ScrollLock";
import { formatCurrency } from "../utils/formatters";
import api from "../services/api";
import { useCaja } from "../context/CajaContext";
import Pagination from "../components/Pagination";
import Toast from "../components/Toast";
import ExportButton from "../components/ExportButton";
import SelectWithOther from "../components/SelectWithOther";
import { useListas } from "../context/ListasContext";
import { TableSkeleton } from "../components/Skeleton";

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";

const CATEGORIAS = [
  { value: "servicios", label: "Servicios" },
  { value: "empleados", label: "Empleados" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "vigilancia", label: "Vigilancia" },
  { value: "limpieza", label: "Limpieza" },
  { value: "papeleria", label: "Papelería" },
  { value: "servicios-publicos", label: "Servicios Públicos" },
  { value: "impuestos", label: "Impuestos" },
  { value: "arriendo", label: "Arriendo" },
  { value: "seguros", label: "Seguros" },
  { value: "transporte", label: "Transporte" },
  { value: "marketing", label: "Marketing" },
  { value: "alimentacion", label: "Alimentación" },
  { value: "dotacion", label: "Dotación" },
  { value: "reparaciones", label: "Reparaciones" },
  { value: "tecnologia", label: "Tecnología" },
  { value: "otros", label: "Otros" },
];

function IconReceipt() {
  return <Receipt className="w-4 h-4" />;
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

function CategoriaBadge({ categoria }) {
  const colors = {
    empleados: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    servicios: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    mantenimiento: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    vigilancia: "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600",
    limpieza: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    papeleria: "bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800",
    "servicios-publicos": "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
    impuestos: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
    arriendo: "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
    seguros: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
    transporte: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
    marketing: "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800",
    alimentacion: "bg-lime-50 dark:bg-lime-900/20 text-lime-700 dark:text-lime-400 border-lime-200 dark:border-lime-800",
    dotacion: "bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800",
    reparaciones: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    tecnologia: "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800",
    otros: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800",
  };
  const label = listas.categoriasGasto.find(c => c.value === categoria)?.label || categoria;
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${colors[categoria] || colors.otros}`}>
      {label}
    </span>
  );
}

export default function Gastos() {
  const navigate = useNavigate();
  const { requestAbrirCaja } = useCaja();
  const { listas } = useListas();
  const [gastos, setGastos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const busquedaDebounced = useDebounce(busqueda);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [gastoId, setGastoId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const mostrarToast = useCallback((mensaje, tipo = "success") => setToast({ mensaje, tipo }), []);
  const [initialLoading, setInitialLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [generandoRecurrentes, setGenerandoRecurrentes] = useState(false);

  const formVacio = { concepto: "", categoria: "", descripcion: "", valor: "", recurrente: false, periodicidad: "mensual" };
  const [form, setForm] = useState(formVacio);

  const generarRecurrentes = async () => {
    setGenerandoRecurrentes(true);
    try {
      const res = await api.post("/gastos/generar-recurrentes");
      mostrarToast(res.data.message || `Se generaron los gastos recurrentes pendientes`, "success");
      cargarGastos();
    } catch (err) { mostrarToast(err.response?.data?.message || "Error al generar gastos recurrentes", "error"); }
    finally { setGenerandoRecurrentes(false); }
  };

  const cargarGastos = async (p = 1) => {
    try {
      const params = { page: p };
      if (busqueda) params.q = busqueda;
      if (fechaInicio) params.fechaInicio = fechaInicio;
      if (fechaFin) params.fechaFin = fechaFin;
      const res = await api.get("/gastos", { params });
      setGastos(res.data.gastos || []);
      setPagination(res.data.pagination || {});
    } catch (error) { console.log(error); }
    finally { setInitialLoading(false); }
  };

  useEffect(() => { cargarGastos(page); }, [page, fechaInicio, fechaFin]);
  useEffect(() => { cargarGastos(1); }, [busquedaDebounced]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const guardarGasto = async () => {
    setCargando(true);
    try {
      const payload = { ...form, valor: parseFloat(form.valor), recurrente: !!form.recurrente };
      if (modoEdicion) {
        await api.put(`/gastos/${gastoId}`, payload);
      } else {
        await api.post("/gastos", payload);
      }
      setMostrarModal(false);
      setForm(formVacio);
      cargarGastos();
      mostrarToast(modoEdicion ? "Gasto actualizado" : "Gasto registrado", "success");
    } catch (error) {
      const msg = error.response?.data?.message || "";
      if (msg.includes("Caja cerrada")) {
        setCargando(false);
        const opened = await requestAbrirCaja();
        if (opened) navigate("/caja");
      } else {
        mostrarToast(msg || "Error al guardar gasto", "error");
        setCargando(false);
      }
    } finally { setCargando(false); }
  };

  const editarGasto = (g) => {
    setModoEdicion(true);
    setGastoId(g.id);
    setForm({ concepto: g.concepto || "", categoria: g.categoria || "", descripcion: g.descripcion || "", valor: g.valor?.toString() || "", recurrente: !!g.recurrente, periodicidad: g.periodicidad || "mensual" });
    setMostrarModal(true);
  };

  const eliminarGasto = async (id) => {
    if (!window.confirm("¿Eliminar este gasto?")) return;
    try {
      await api.delete(`/gastos/${id}`);
      cargarGastos();
    } catch (error) {
      console.log(error);
    }
  };

  const gastosFiltrados = gastos;

  const total = gastosFiltrados.reduce((sum, g) => sum + (g.valor || 0), 0);
  const formatValor = (v) => formatCurrency(v);

  return (
    <div className="min-h-screen bg-page dark:bg-slate-900 p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Gastos</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Registra y controla todos los egresos del parqueadero</p>
        </div>
        <div className="flex gap-3">
          <ExportButton data={gastosFiltrados.map(g => ({ Concepto: g.concepto, Categoria: (g.categoria || "").charAt(0).toUpperCase() + (g.categoria || "").slice(1).replace(/-/g, " "), Descripcion: g.descripcion || "", Valor: `$${(g.valor || 0).toLocaleString()}`, Fecha: g.fecha ? new Date(g.fecha).toLocaleDateString("es-CO") : "" }))} filename="gastos" title="Gastos" columns={[{ key: 'Concepto', label: 'Concepto' }, { key: 'Categoria', label: 'Categoría' }, { key: 'Descripcion', label: 'Descripción' }, { key: 'Valor', label: 'Valor' }, { key: 'Fecha', label: 'Fecha' }]} />
          <button onClick={generarRecurrentes} disabled={generandoRecurrentes} className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 shadow-lg shadow-purple-600/20 hover:shadow-purple-600/30 disabled:opacity-50 active:scale-[0.98]">
            <RefreshCw className={`w-4 h-4 ${generandoRecurrentes ? "animate-spin" : ""}`} /> {generandoRecurrentes ? "Generando..." : "Generar recurrentes"}
          </button>
          <button onClick={() => { setModoEdicion(false); setGastoId(null); setForm(formVacio); setMostrarModal(true); }} className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 shadow-lg shadow-teal-600/20 hover:shadow-teal-600/30 active:scale-[0.98]">
            <IconPlus /> Nuevo Gasto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm">
          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide font-medium">Total Gastos</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{formatValor(total)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm">
          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide font-medium">Cantidad</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{`${gastosFiltrados.length} registros`}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm">
          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide font-medium">Promedio</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{gastosFiltrados.length ? formatValor(total / gastosFiltrados.length) : "$0"}</p>
        </div>
      </div>

      <div className="p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 dark:bg-slate-800 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><IconSearch /></div>
            <input type="text" placeholder="Buscar gastos..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" />
          </div>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-slate-50 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" title="Desde" />
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-slate-50 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" title="Hasta" />
          {(fechaInicio || fechaFin) && (
            <button onClick={() => { setFechaInicio(""); setFechaFin(""); }} className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600">Limpiar</button>
          )}
        </div>
      </div>

      {initialLoading ? <TableSkeleton rows={8} cols={7} /> : (
      <div className="rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800 dark:bg-slate-700">
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Concepto</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Categoría</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Descripción</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Valor</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">Rec.</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {gastosFiltrados.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center"><p className="text-slate-400 dark:text-slate-500 text-sm">No hay gastos registrados</p></td></tr>
              ) : (
                gastosFiltrados.map((gasto) => (
                  <tr key={gasto.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors duration-150">
                    <td className="px-4 py-3.5"><p className="text-sm font-medium text-slate-800 dark:text-white">{gasto.concepto}</p></td>
                    <td className="px-4 py-3.5"><CategoriaBadge categoria={gasto.categoria} /></td>
                    <td className="px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400">{gasto.descripcion || "—"}</td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-red-600 dark:text-red-400 text-right">{formatValor(gasto.valor)}</td>
                    <td className="px-4 py-3.5 text-center">
                      {gasto.recurrente ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800" title={`Cada ${gasto.periodicidad || "—"}`}>
                          {gasto.periodicidad === "diaria" ? "Día" : gasto.periodicidad === "semanal" ? "Sem" : gasto.periodicidad === "quincenal" ? "15d" : gasto.periodicidad === "mensual" ? "Mes" : gasto.periodicidad === "bimestral" ? "2m" : gasto.periodicidad === "trimestral" ? "3m" : gasto.periodicidad === "semestral" ? "6m" : gasto.periodicidad === "anual" ? "Año" : "Sí"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400 text-right">{gasto.fecha ? new Date(gasto.fecha).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => editarGasto(gasto)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 border border-teal-200 dark:border-teal-800 rounded-lg transition-all">
                          <IconEdit /> Editar
                        </button>
                        <button onClick={() => eliminarGasto(gasto.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg transition-all">
                          <IconTrash /> Eliminar
                        </button>
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
        open={mostrarModal}
        onClose={() => setMostrarModal(false)}
        gradient="from-rose-600 to-pink-500"
        icon={Receipt}
        titulo={modoEdicion ? "Editar Gasto" : "Nuevo Gasto"}
        subtitulo="Registra un egreso del parqueadero"
        footer={
          <>
            <button onClick={() => setMostrarModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 active:scale-[0.98] transition-all">Cancelar</button>
            <button onClick={guardarGasto} disabled={cargando} className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-pink-500 rounded-xl shadow-lg shadow-rose-600/20 hover:shadow-rose-600/30 disabled:opacity-50 active:scale-[0.98] transition-all">
              {cargando ? "Guardando..." : "Guardar Gasto"}
            </button>
          </>
        }
      >
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
          <div>
            <label className={labelClass}>Concepto</label>
            <input name="concepto" placeholder="Ej: Pago empleados, Compra insumos..." value={form.concepto} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <SelectWithOther label="Categoría" name="categoria" value={form.categoria} onChange={handleChange} options={listas.categoriasGasto} otherLabel="Otra categoría" />
          </div>
          <div>
            <label className={labelClass}>Valor ($)</label>
            <input name="valor" type="number" min="0" placeholder="0" value={form.valor} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Descripción (opcional)</label>
            <textarea name="descripcion" placeholder="Detalles del gasto..." value={form.descripcion} onChange={handleChange} className={inputClass + " resize-none"} rows={2} />
          </div>
          <div className="border-t border-slate-200 dark:border-slate-600 pt-4">
            <div className="flex items-center gap-3 mb-3">
              <input type="checkbox" name="recurrente" checked={form.recurrente} onChange={handleChange} className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500/20" />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Gasto recurrente</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Se generará automáticamente según la periodicidad</p>
              </div>
            </div>
            {form.recurrente && (
              <SelectWithOther label="Periodicidad" name="periodicidad" value={form.periodicidad} onChange={handleChange} options={[
                { value: "diaria", label: "Diaria" },
                { value: "semanal", label: "Semanal" },
                { value: "quincenal", label: "Quincenal" },
                { value: "mensual", label: "Mensual" },
                { value: "bimestral", label: "Bimestral" },
                { value: "trimestral", label: "Trimestral" },
                { value: "semestral", label: "Semestral" },
                { value: "anual", label: "Anual" },
              ]} otherLabel="Otra periodicidad" />
            )}
          </div>
        </div>
      </FormModal>

        <style>{`
          @keyframes modal-in { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
          .animate-modal-in { animation: modal-in 0.25s ease-out; }
        `}</style>

        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
      <ScrollLock cuando={mostrarModal} />
      </div>
  );
}

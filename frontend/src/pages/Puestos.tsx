import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Search, ParkingCircle, X, ChevronDown, Filter } from "lucide-react";
import api from "../services/api";
import Pagination from "../components/Pagination";
import ExportButton from "../components/ExportButton";
import PuestoCard from "../components/puestos/PuestoCard";
import PuestoFormModal from "../components/puestos/PuestoFormModal";
import PuestoBulkModal from "../components/puestos/PuestoBulkModal";
import PuestoDetailModal from "../components/puestos/PuestoDetailModal";
import PuestoAssignModal from "../components/puestos/PuestoAssignModal";
import { TIPOS_PUESTO, ESTADOS_PUESTO } from "../components/puestos/puesto.constants";
import { getZonaColor, combinarTipos } from "../components/puestos/puesto.helpers";
import { useListas } from "../context/ListasContext";
import { PuestosGridSkeleton } from "../components/Skeleton";

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";

function Toast({ mensaje, tipo, onClose }) {
  useEffect(() => { if (mensaje) { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); } }, [mensaje]);
  if (!mensaje) return null;
  const colores = tipo === "success" ? "bg-emerald-600" : tipo === "error" ? "bg-red-600" : "bg-slate-800";
  return (
    <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-medium ${colores} animate-modal-in flex items-center gap-3`}>
      <span>{mensaje}</span>
      <button onClick={onClose} className="p-1 hover:bg-white/20 rounded"><X className="w-4 h-4" /></button>
    </div>
  );
}

function ConfirmDialog({ abierto, titulo, mensaje, onConfirm, onCancel }) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-center items-center px-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-modal-in p-6 text-center">
        <p className="text-lg font-bold text-slate-800 dark:text-white mb-2">{titulo}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 whitespace-pre-line">{mensaje}</p>
        <div className="flex justify-center gap-3">
          <button onClick={onCancel} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600">Cancelar</button>
          <button onClick={() => { onConfirm(); onCancel(); }} className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function IconPlus() { return <Plus className="w-5 h-5" />; }

function FiltroDropdown({ label, opciones, valor, onChange, color = "teal", renderOption }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const seleccionado = opciones.find(o => o.value === valor);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  const colores = {
    teal: { active: "bg-teal-600 text-white border-teal-600", hover: "hover:bg-teal-50 dark:hover:bg-teal-900/20" },
    indigo: { active: "bg-indigo-600 text-white border-indigo-600", hover: "hover:bg-indigo-50 dark:hover:bg-indigo-900/20" },
  };
  const c = colores[color] || colores.teal;
  const isActive = valor !== "" && valor !== "TODOS" && valor !== "TODAS";

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setAbierto(!abierto)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
          isActive
            ? `${c.active} shadow-md`
            : `bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 ${c.hover}`
        }`}>
        <Filter className="w-3 h-3" />
        {seleccionado?.label || label}
        <ChevronDown className={`w-3 h-3 transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && (
        <div className="absolute z-50 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl overflow-hidden">
          {opciones.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setAbierto(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                valor === o.value
                  ? "bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 font-medium"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}>
              {renderOption ? renderOption(o) : o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const formVacio = { codigo: "", tipoPuesto: "carro", estado: "LIBRE", observacion: "", zona: "" };
const bulkFormVacio = { prefijo: "", cantidad: 1, tipoPuesto: "carro", zona: "" };

export default function Puestos() {
  const { listas } = useListas();
  const [puestos, setPuestos] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [puestoId, setPuestoId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroZona, setFiltroZona] = useState("TODAS");
  const [search, setSearch] = useState("");
  const [mostrarBulk, setMostrarBulk] = useState(false);
  const [bulkForm, setBulkForm] = useState(bulkFormVacio);
  const [form, setForm] = useState(formVacio);
  const [tiposSeleccionados, setTiposSeleccionados] = useState(["carro"]);
  const [otrosTipos, setOtrosTipos] = useState("");
  const [bulkTipos, setBulkTipos] = useState(["carro"]);
  const [bulkOtrosTipos, setBulkOtrosTipos] = useState("");
  const cargandoRef = useRef(false);

  const cargarPuestos = useCallback(async (p = 1) => {
    if (cargandoRef.current) return;
    cargandoRef.current = true;
    try {
      const params = { page: p };
      if (filtroEstado !== "TODOS") params.estado = filtroEstado;
      if (search.trim()) params.q = search.trim();
      const res = await api.get("/puestos", { params });
      setPuestos(res.data.puestos || []);
      setPagination(res.data.pagination || {});
    } finally {
      cargandoRef.current = false;
      setInitialLoading(false);
    }
  }, [filtroEstado, search]);

  useEffect(() => { cargarPuestos(page); }, [page, cargarPuestos]);

  const [todosPuestos, setTodosPuestos] = useState([]);
  const cargarTodosPuestos = useCallback(async () => {
    try { const res = await api.get("/puestos?all=true"); setTodosPuestos(res.data.puestos || []); } catch { }
  }, []);
  useEffect(() => { cargarTodosPuestos(); }, [cargarTodosPuestos]);

  useEffect(() => {
    let ultimo = 0;
    const refrescar = () => { const ahora = Date.now(); if (ahora - ultimo < 5000) return; ultimo = ahora; cargarPuestos(page); cargarTodosPuestos(); };
    window.addEventListener("focus", refrescar);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refrescar(); });
    return () => {
      window.removeEventListener("focus", refrescar);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, [page, cargarPuestos, cargarTodosPuestos]);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleBulkChange = ({ target }) => setBulkForm(prev => ({ ...prev, [target.name]: target.value }));

  const handleTipoChange = (value) => {
    const nuevos = tiposSeleccionados.includes(value)
      ? tiposSeleccionados.filter(t => t !== value)
      : [...tiposSeleccionados, value];
    const combinados = combinarTipos(nuevos, otrosTipos);
    setTiposSeleccionados(combinados.filter(t => listas.tiposPuesto.some(pt => pt.value === t)));
    setForm(p => ({ ...p, tipoPuesto: combinados.join(",") }));
  };

  const handleOtrosChange = (value) => {
    setOtrosTipos(value);
    setForm(p => ({ ...p, tipoPuesto: combinarTipos(tiposSeleccionados, value).join(",") }));
  };

  const handleBulkTipoChange = (value) => {
    const nuevos = bulkTipos.includes(value)
      ? bulkTipos.filter(t => t !== value)
      : [...bulkTipos, value];
    const combinados = combinarTipos(nuevos, bulkOtrosTipos);
    setBulkTipos(combinados.filter(t => listas.tiposPuesto.some(pt => pt.value === t)));
    setBulkForm(p => ({ ...p, tipoPuesto: combinados.join(",") }));
  };

  const handleBulkOtrosChange = (value) => {
    setBulkOtrosTipos(value);
    setBulkForm(p => ({ ...p, tipoPuesto: combinarTipos(bulkTipos, value).join(",") }));
  };

  const guardarPuesto = async () => {
    setCargando(true);
    try {
      const payload = { ...form, tipoPuesto: tiposSeleccionados.join(",") };
      if (modoEdicion) {
        await api.put(`/puestos/${puestoId}`, payload);
        mostrarToast("Puesto actualizado");
      } else {
        await api.post("/puestos", payload);
        mostrarToast("Puesto creado");
      }
      setMostrarModal(false);
      cargarPuestos();
      cargarTodosPuestos();
    } catch (error) {
      mostrarToast(error.response?.data?.message || "Error al guardar puesto", "error");
    } finally { setCargando(false); }
  };

  const guardarBulk = async () => {
    if (!bulkForm.prefijo || !bulkForm.cantidad) return mostrarToast("Completa prefijo y cantidad", "error");
    try {
      const res = await api.post("/puestos/masivos", { ...bulkForm, tipoPuesto: bulkTipos.join(",") });
      setMostrarBulk(false);
      cargarPuestos(); cargarTodosPuestos();
      mostrarToast(res.data.message || "Puestos creados", "success");
    } catch (err) {
      mostrarToast(err.response?.data?.message || "Error al crear puestos masivos", "error");
    }
  };

  const editarPuesto = (p) => {
    setModoEdicion(true);
    setPuestoId(p.id);
    const tipos = (p.tipoPuesto || "carro").split(",").map(t => t.trim()).filter(Boolean);
    const conocidos = tipos.filter(t => listas.tiposPuesto.some(pt => pt.value === t));
    const otros = tipos.filter(t => !listas.tiposPuesto.some(pt => pt.value === t));
    setTiposSeleccionados(conocidos.length ? conocidos : ["carro"]);
    setOtrosTipos(otros.join(", "));
    setForm({ codigo: p.codigo || "", tipoPuesto: p.tipoPuesto || "carro", estado: p.estado || "LIBRE", observacion: p.observacion || "", zona: p.zona || "" });
    setMostrarModal(true);
  };

  const eliminarPuesto = async (id) => {
    try { await api.delete(`/puestos/${id}`); mostrarToast("Puesto eliminado"); cargarPuestos(); cargarTodosPuestos(); } catch (error) { mostrarToast(error.response?.data?.message || "Error", "error"); }
  };

  const liberarPuesto = async (puesto) => {
    const ingreso = puesto.ingresos?.[0];
    if (!ingreso) {
      try {
        const res = await api.get(`/puestos/${puesto.id}`);
        const fresh = res.data.puesto;
        const freshIngreso = fresh?.ingresos?.[0];
        if (freshIngreso) {
          await api.put(`/ingresos/liberar/${freshIngreso.id}`);
          mostrarToast("Puesto liberado");
        } else {
          await api.put(`/puestos/${puesto.id}`, { estado: "LIBRE" });
          mostrarToast("Puesto liberado");
        }
        cargarPuestos(); cargarTodosPuestos();
      } catch (error) { mostrarToast(error.response?.data?.message || "Error al liberar", "error"); }
      return;
    }
    try {
      await api.put(`/ingresos/liberar/${ingreso.id}`);
      mostrarToast("Puesto liberado");
      cargarPuestos(); cargarTodosPuestos();
    } catch (error) { mostrarToast(error.response?.data?.message || "Error al liberar", "error"); }
  };

  const marcarMantenimiento = async (puesto) => {
    try {
      await api.put(`/puestos/${puesto.id}`, { estado: "MANTENIMIENTO" });
      mostrarToast("Puesto en mantenimiento");
      cargarPuestos(); cargarTodosPuestos();
    } catch (error) { mostrarToast(error.response?.data?.message || "Error", "error"); }
  };

  const finalizarAusenciaPuesto = async (puesto) => {
    try {
      const ingreso = puesto.ingresos?.[0];
      const mensualidad = puesto.mensualidades?.[0];
      const vehiculoId = ingreso?.vehiculoId || mensualidad?.vehiculoId;
      if (!vehiculoId) {
        await api.put(`/puestos/${puesto.id}`, { estado: "LIBRE" });
        mostrarToast("Puesto liberado"); cargarPuestos(); cargarTodosPuestos(); return;
      }
      const res = await api.get("/ausencias", { params: { estado: "ACTIVA", q: ingreso?.vehiculo?.placa || mensualidad?.vehiculo?.placa, limit: 1 } });
      const ausencia = res.data.ausencias?.[0];
      if (ausencia) {
        await api.put(`/ausencias/finalizar/${ausencia.id}`);
        mostrarToast("Ausencia finalizada — puesto disponible");
      } else {
        await api.put(`/puestos/${puesto.id}`, { estado: "LIBRE" });
        mostrarToast("Puesto liberado");
      }
      cargarPuestos(); cargarTodosPuestos();
    } catch (error) { mostrarToast(error.response?.data?.message || "Error al finalizar ausencia", "error"); }
  };

  const abrirNuevo = () => {
    setModoEdicion(false);
    setPuestoId(null);
    setForm(formVacio);
    setTiposSeleccionados(["carro"]);
    setOtrosTipos("");
    const nums = [...new Set(
      todosPuestos
        .map(p => { const m = p.codigo.match(/^Puesto (\d+)$/); return m ? parseInt(m[1], 10) : null; })
        .filter(Boolean)
    )].sort((a, b) => a - b);
    let sugerido = 1;
    for (const n of nums) { if (n === sugerido) sugerido++; else break; }
    setForm(prev => ({ ...prev, codigo: `Puesto ${sugerido}` }));
    setMostrarModal(true);
  };

  const guardarEntrada = async (clienteId, vehiculoId, puestoId) => {
    try {
      await api.post("/ingresos", { clienteId: Number(clienteId), vehiculoId: Number(vehiculoId), puestoId });
      setAsignarPuesto(null);
      mostrarToast("Entrada registrada");
      cargarPuestos(); cargarTodosPuestos();
    } catch (error) { mostrarToast(error.response?.data?.message || "Error al asignar puesto", "error"); }
  };

  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const [confirm, setConfirm] = useState({ abierto: false, titulo: "", mensaje: "", onConfirm: () => {} });
  const mostrarToast = useCallback((mensaje, tipo = "success") => setToast({ mensaje, tipo }), []);
  const mostrarConfirm = (titulo, mensaje, onConfirm) => setConfirm({ abierto: true, titulo, mensaje, onConfirm });

  const [asignarPuesto, setAsignarPuesto] = useState(null);
  const [detallePuesto, setDetallePuesto] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [vehiculosActivos, setVehiculosActivos] = useState([]);
  const [asignarForm, setAsignarForm] = useState({ clienteId: "", vehiculoId: "" });

  const cargarClientes = async () => {
    try { const res = await api.get("/clientes?limit=500"); setClientes(res.data.clientes || []); } catch { }
  };
  const cargarVehiculos = async (clienteId) => {
    if (!clienteId) { setVehiculos([]); setVehiculosActivos([]); return; }
    try {
      const [vehRes, ingRes] = await Promise.all([
        api.get(`/vehiculos?clienteId=${clienteId}&limit=200`),
        api.get(`/ingresos?clienteId=${clienteId}&estado=ACTIVO&limit=50`),
      ]);
      const todosVehiculos = vehRes.data.vehiculos || [];
      const activos = ingRes.data.ingresos || [];
      const idsActivos = new Set(activos.map(i => i.vehiculoId));
      setVehiculosActivos(activos);
      setVehiculos(todosVehiculos.filter(v => !idsActivos.has(v.id)));
    } catch { }
  };
  useEffect(() => { if (asignarForm.clienteId) cargarVehiculos(asignarForm.clienteId); }, [asignarForm.clienteId]);
  useEffect(() => { if (vehiculos.length === 1) setAsignarForm(f => ({ ...f, vehiculoId: vehiculos[0].id.toString() })); }, [vehiculos]);

  const puestosOrdenados = [...puestos].sort((a, b) => {
    const numA = parseInt(a.codigo.match(/(\d+)$/)?.[1] || "0", 10);
    const numB = parseInt(b.codigo.match(/(\d+)$/)?.[1] || "0", 10);
    return numA - numB || a.codigo.localeCompare(b.codigo);
  });
  const puestosFiltrados = puestosOrdenados.filter(p => {
    if (filtroEstado !== "TODOS" && p.estado !== filtroEstado) return false;
    if (filtroTipo !== "TODOS" && !(p.tipoPuesto || "").split(",").map(t => t.trim()).includes(filtroTipo)) return false;
    if (filtroZona !== "TODAS" && (p.zona || "") !== filtroZona) return false;
    return true;
  });

  const conteo = {};
  todosPuestos.forEach(p => { conteo[p.estado] = (conteo[p.estado] || 0) + 1; });

  return (
    <div className="min-h-screen bg-page dark:bg-slate-900 p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Puestos</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Visualiza y administra los espacios del parqueadero</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={puestosFiltrados.map(p => ({ Codigo: p.codigo, Tipo: (p.tipoPuesto || "").split(",").map(t => t.trim()).filter(Boolean).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", "), Zona: p.zona || "", Estado: (ESTADOS_PUESTO.find(e => e.value === p.estado)?.label || p.estado).charAt(0).toUpperCase() + (ESTADOS_PUESTO.find(e => e.value === p.estado)?.label || p.estado).slice(1).toLowerCase(), Observacion: p.observacion || "" }))} filename="puestos" title="Puestos" columns={[{ key: 'Codigo', label: 'Código' }, { key: 'Tipo', label: 'Tipo' }, { key: 'Zona', label: 'Zona' }, { key: 'Estado', label: 'Estado' }, { key: 'Observacion', label: 'Observación' }]} />
          <button onClick={abrirNuevo} className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-lg shadow-teal-600/20 active:scale-[0.98]">
            <IconPlus /> Nuevo Puesto
          </button>
          <button onClick={() => { setBulkForm({ ...bulkFormVacio, prefijo: "Puesto" }); setBulkTipos(["carro"]); setBulkOtrosTipos(""); setMostrarBulk(true); }} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-lg shadow-indigo-600/20 active:scale-[0.98]">
            <IconPlus /> Crear Masivos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-3.5 shadow-sm cursor-pointer" onClick={() => setFiltroEstado("TODOS")}>
          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-medium">Total</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{puestos.length}</p>
        </div>
        {ESTADOS_PUESTO.map(est => (
          <div key={est.value} className={`rounded-xl border p-3.5 cursor-pointer transition-all ${filtroEstado === est.value ? 'ring-2 ring-teal-500 ' : ''}${est.bg}`} onClick={() => setFiltroEstado(filtroEstado === est.value ? "TODOS" : est.value)}>
            <p className={`text-xs font-medium uppercase tracking-wide ${est.text}`}>{est.label}</p>
            <p className={`text-2xl font-bold mt-1 ${est.text}`}>{conteo[est.value] || 0}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por código o tipo..." className={inputClass + " pl-10"} />
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
        <FiltroDropdown
          label="Tipo"
          opciones={[
            { value: "TODOS", label: "Todos" },
            ...listas.tiposPuesto,
          ]}
          valor={filtroTipo}
          onChange={setFiltroTipo}
          color="teal"
        />
        <FiltroDropdown
          label="Zona"
          opciones={[
            { value: "TODAS", label: "Todas" },
            ...[...new Set(todosPuestos.map(p => p.zona).filter(Boolean))].sort().map(z => ({ value: z, label: z })),
          ]}
          valor={filtroZona}
          onChange={setFiltroZona}
          color="indigo"
          renderOption={(o) => {
            if (o.value === "TODAS") return o.label;
            const zc = getZonaColor(o.value);
            return <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: zc }} />{o.label}</span>;
          }}
        />
        {(filtroTipo !== "TODOS" || filtroZona !== "TODAS") && (
          <button onClick={() => { setFiltroTipo("TODOS"); setFiltroZona("TODAS"); }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>

      {initialLoading ? <PuestosGridSkeleton count={12} /> : (
      <>
      {puestosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-slate-100 dark:border-slate-700 dark:bg-slate-800 p-16 text-center">
          <ParkingCircle className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">No hay puestos con esos filtros</p>
        </div>
      ) : (
        <div className="space-y-6">
          {ESTADOS_PUESTO.filter(est => puestosFiltrados.some(p => p.estado === est.value)).map(est => {
            const items = puestosFiltrados.filter(p => p.estado === est.value);
            return (
              <div key={est.value}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${est.dot}`} />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{est.label}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${est.bg}`}>{items.length}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {items.map(puesto => (
                    <PuestoCard key={puesto.id} puesto={puesto} onDetalle={(p) => setDetallePuesto(p)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={pagination.page || 1} totalPages={pagination.totalPages || 1} total={pagination.total || 0} onPageChange={setPage} />
      </>
      )}

      <PuestoFormModal
        abierto={mostrarModal}
        modoEdicion={modoEdicion}
        form={form}
        tiposSeleccionados={tiposSeleccionados}
        otrosTipos={otrosTipos}
        onClose={() => { setMostrarModal(false); }}
        onSave={guardarPuesto}
        onChange={handleChange}
        onTipoChange={handleTipoChange}
        onOtrosChange={handleOtrosChange}
        cargando={cargando}
      />

      <PuestoBulkModal
        abierto={mostrarBulk}
        bulkForm={bulkForm}
        bulkTipos={bulkTipos}
        bulkOtrosTipos={bulkOtrosTipos}
        onClose={() => { setMostrarBulk(false); }}
        onSave={guardarBulk}
        onChange={handleBulkChange}
        onTipoChange={handleBulkTipoChange}
        onOtrosChange={handleBulkOtrosChange}
      />

      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
      <ConfirmDialog abierto={confirm.abierto} titulo={confirm.titulo} mensaje={confirm.mensaje} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(c => ({ ...c, abierto: false }))} />

      <PuestoDetailModal
        puesto={detallePuesto}
        onClose={() => setDetallePuesto(null)}
        onEdit={editarPuesto}
        onLiberar={liberarPuesto}
        onMantenimiento={marcarMantenimiento}
        onFinalizarAusencia={finalizarAusenciaPuesto}
        onAsignar={(p) => { setAsignarForm({ clienteId: "", vehiculoId: "" }); setAsignarPuesto(p); cargarClientes(); }}
        mostrarConfirm={mostrarConfirm}
        onDelete={(id) => eliminarPuesto(id)}
      />

      <PuestoAssignModal
        puesto={asignarPuesto}
        clientes={clientes}
        vehiculos={vehiculos}
        vehiculosActivos={vehiculosActivos}
        form={asignarForm}
        onClose={() => setAsignarPuesto(null)}
        onClientChange={(id) => setAsignarForm(f => ({ ...f, clienteId: id?.toString() || "", vehiculoId: "" }))}
        onVehiculoChange={(id) => setAsignarForm(f => ({ ...f, vehiculoId: id }))}
        onSave={async () => {
          if (!asignarForm.clienteId || !asignarForm.vehiculoId) return mostrarToast("Selecciona cliente y vehículo", "error");
          const v = vehiculos.find(ve => ve.id === parseInt(asignarForm.vehiculoId));
          const tipos = (asignarPuesto.tipoPuesto || "").split(",").map(t => t.trim()).filter(Boolean);
          if (v && tipos.length > 0 && !tipos.includes(v.tipo)) return mostrarToast(`Este puesto solo acepta: ${tipos.join(", ")}`, "error");
          try {
            const res = await api.get("/mensualidades", { params: { clienteId: Number(asignarForm.clienteId), estado: "ACTIVA", limit: 50 } });
            const planes = res.data.mensualidades || [];
            const ejecutar = () => guardarEntrada(asignarForm.clienteId, asignarForm.vehiculoId, asignarPuesto.id);
            if (planes.length > 0) {
              const listaPlanes = planes.map(p => `• ${p.plan?.nombre || "Plan"} (${p.vehiculo?.placa || "sin vehículo"}) — vence ${new Date(p.fechaFin).toLocaleDateString("es-CO")}`).join("\n");
              mostrarConfirm(
                "Cliente con plan activo",
                `Este cliente tiene ${planes.length} plan(es) activo(s):\n${listaPlanes}\n\n¿Deseas registrar una entrada por separado? Esto podría generar un cobro adicional.`,
                ejecutar
              );
            } else {
              ejecutar();
            }
          } catch { guardarEntrada(asignarForm.clienteId, asignarForm.vehiculoId, asignarPuesto.id); }
        }}
      />

      <style>{`
        @keyframes modal-in { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-modal-in { animation: modal-in 0.25s ease-out; }
      `}</style>
    </div>
  );
}

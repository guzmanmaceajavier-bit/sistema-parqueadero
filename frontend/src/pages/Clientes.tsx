import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { AlertTriangle, CalendarDays, Car, CheckCircle, MessageCircle, Pencil, Plus, RefreshCw, Search, Trash2, Upload, User, UserPlus, X } from "lucide-react";
import { Link } from "react-router-dom";
import useDebounce from "../hooks/useDebounce";
import ScrollLock from "../components/ScrollLock";
import api from "../services/api";
import SelectWithOther from "../components/SelectWithOther";
import Select from "../components/ui/Select";
import { MARCAS_VEHICULO } from "../constants/vehiculo";
import ExportButton from "../components/ExportButton";
import Pagination from "../components/Pagination";
import FormModal from "../components/ui/FormModal";
import Toast from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";

const ESTADOS_CLIENTE = [
  { value: "ACTIVO", label: "Activo", bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" },
  { value: "AUSENTE", label: "Ausente", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500" },
  { value: "VENCIDO", label: "Vencido", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800", dot: "bg-red-500" },
  { value: "SUSPENDIDO", label: "Suspendido", bg: "bg-slate-100 dark:bg-slate-700", text: "text-slate-600 dark:text-slate-300", border: "border-slate-300 dark:border-slate-600", dot: "bg-slate-400" },
  { value: "MOROSO", label: "Moroso", bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800", dot: "bg-rose-500" },
];

const TIPOS_VEHICULO_BASE = [
  { value: "moto", label: "Moto" },
  { value: "carro", label: "Carro" },
  { value: "camioneta", label: "Camioneta" },
  { value: "bicicleta", label: "Bicicleta" },
];

const CLASES_VEHICULO = [
  { value: "", label: "Seleccionar..." },
  { value: "particular", label: "Particular" },
  { value: "publico", label: "Público" },
  { value: "carga", label: "Carga" },
  { value: "electrico", label: "Eléctrico" },
  { value: "deportivo", label: "Deportivo" },
  { value: "especial", label: "Especial" },
];

/* ─── Componentes auxiliares ─── */

function EstadoBadge({ estado }) {
  const config = ESTADOS_CLIENTE.find(e => e.value === estado) || ESTADOS_CLIENTE[0];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function IconUser() {
    return <User className="w-4 h-4" />;
  }

function IconCar() {
    return <Car className="w-4 h-4" />;
  }

function IconSearch() {
    return <Search className="w-5 h-5 text-slate-400" />;
  }

function IconPlus() {
    return <Plus className="w-5 h-5" />;
  }

function IconEdit() {
    return <Pencil className="w-4 h-4" />;
  }

function IconTrash() {
    return <Trash2 className="w-4 h-4" />;
  }

function IconX() {
    return <X className="w-5 h-5" />;
  }

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";

/* ─── Componente Principal ─── */

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const busquedaDebounced = useDebounce(busqueda);
  const [filtroRapido, setFiltroRapido] = useState("");
  const [filtroExtra, setFiltroExtra] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [clienteId, setClienteId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const [confirm, setConfirm] = useState({ abierto: false, titulo: "", mensaje: "", onConfirm: () => {} });
  const mostrarToast = useCallback((mensaje, tipo = "success") => setToast({ mensaje, tipo }), []);
  const [planes, setPlanes] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [tarifas, setTarifas] = useState([]);
  const [conSuscripcion, setConSuscripcion] = useState(false);
  const [tarifaForm, setTarifaForm] = useState({ planId: "", puestoId: "", observacion: "" });
  const [conReserva, setConReserva] = useState(false);
  const [reservaForm, setReservaForm] = useState({ fechaInicio: "", fechaFin: "", puestoId: null, observaciones: "" });
  const [conIngreso, setConIngreso] = useState(false);
  const [ingresoForm, setIngresoForm] = useState({ tarifaId: "", puestoId: "" });
  const existenteRef = useRef({ mensualidadId: null, reservaId: null, ingresoId: null });

  const tiposVehiculo = useMemo(() => {
    if (!tarifas.length) return [{ value: "", label: "Seleccionar..." }, ...TIPOS_VEHICULO_BASE];
    const disponibles = new Set(tarifas.map(t => t.tipoVehiculo));
    if (disponibles.has("todos")) return [{ value: "", label: "Seleccionar..." }, ...TIPOS_VEHICULO_BASE];
    const filtrados = TIPOS_VEHICULO_BASE.filter(t => disponibles.has(t.value));
    if (!filtrados.length) return [{ value: "", label: "Seleccionar..." }, ...TIPOS_VEHICULO_BASE];
    return [{ value: "", label: "Seleccionar..." }, ...filtrados];
  }, [tarifas]);

  const [renovarCli, setRenovarCli] = useState(null);
  const [renovarPlanId, setRenovarPlanId] = useState("");
  const [renovando, setRenovando] = useState(false);

  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importando, setImportando] = useState(false);
  const [importResultado, setImportResultado] = useState(null);

  const [recargaCli, setRecargaCli] = useState(null);
  const [recargaMonto, setRecargaMonto] = useState("");
  const [recargando, setRecargando] = useState(false);

  const vehiculoVacio = { placa: "", tipo: "", clase: "", marca: "", color: "", observaciones: "" };

  const formVacio = {
    nombres: "",
    apellidos: "",
    documento: "",
    telefono: "",
    email: "",
    direccion: "",
    observaciones: "",
    estado: "ACTIVO",
    vehiculos: [{ ...vehiculoVacio }],
  };

  const [form, setForm] = useState(formVacio);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const cargarClientes = async (p = 1) => {
    try {
      const params = { page: p };
      if (busqueda) params.q = busqueda;
      if (filtroRapido) params.estado = filtroRapido;
      if (filtroExtra) {
        if (filtroExtra === "CON_PLAN") params.tienePlan = "true";
        else if (filtroExtra === "SIN_PLAN") params.tienePlan = "false";
        else if (filtroExtra === "CON_RESERVA") params.tieneReserva = "true";
        else if (filtroExtra === "SIN_RESERVA") params.tieneReserva = "false";
        else if (filtroExtra === "CON_VEHICULO") params.tieneVehiculo = "true";
        else if (filtroExtra === "SIN_VEHICULO") params.tieneVehiculo = "false";
      }
      const response = await api.get("/clientes", { params });
      setClientes(response.data.clientes || []);
      setPagination(response.data.pagination || {});
    } catch (error) {
      console.log(error);
    }
  };

  const cargarPlanes = async () => {
    try { const res = await api.get("/planes"); setPlanes((res.data.planes || []).filter(p => p.activo)); } catch { }
  };
  const cargarPuestos = async () => {
    try { const res = await api.get("/puestos?limit=500"); setPuestos(res.data.puestos || []); } catch { }
  };
  const cargarTarifas = async () => {
    try { const res = await api.get("/tarifas"); setTarifas((res.data.tarifas || []).filter(t => t.activa)); } catch { }
  };
  useEffect(() => { cargarPlanes(); cargarPuestos(); cargarTarifas(); }, []);
  useEffect(() => { cargarClientes(page); }, [page, filtroRapido, filtroExtra]);
  useEffect(() => { cargarClientes(1); }, [busquedaDebounced]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const val = name.endsWith(".placa") ? value.toUpperCase() : value;
    const m = name.match(/^vehiculos\.(\d+)\.(.+)$/);
    if (m) {
      const idx = parseInt(m[1]);
      const field = m[2];
      setForm(prev => {
        const v = [...prev.vehiculos];
        v[idx] = { ...v[idx], [field]: val };
        return { ...prev, vehiculos: v };
      });
    } else {
      setForm(prev => ({ ...prev, [name]: val }));
    }
  };

  const agregarVehiculo = () => setForm(prev => ({ ...prev, vehiculos: [...prev.vehiculos, { ...vehiculoVacio }] }));
  const quitarVehiculo = (idx) => setForm(prev => ({ ...prev, vehiculos: prev.vehiculos.filter((_, i) => i !== idx) }));

  const guardarMensualidad = async (clienteIdNum, vehiculoIdNum) => {
    if (!conSuscripcion || !tarifaForm.planId) return;
    const plan = planes.find(p => p.id === Number(tarifaForm.planId));
    if (!plan) return;
    if (existenteRef.current.mensualidadId) {
      await api.put(`/mensualidades/${existenteRef.current.mensualidadId}`, {
        vehiculoId: vehiculoIdNum,
        planId: Number(tarifaForm.planId),
        valor: plan.valor,
        observacion: tarifaForm.observacion,
        ...(tarifaForm.puestoId ? { puestoId: Number(tarifaForm.puestoId) } : {}),
      });
    } else {
      const fechaInicio = new Date().toISOString().split("T")[0];
      const fin = new Date(Date.now() + plan.duracionDias * 86400000).toISOString().split("T")[0];
      await api.post("/mensualidades", {
        clienteId: clienteIdNum,
        vehiculoId: vehiculoIdNum,
        planId: Number(tarifaForm.planId),
        valor: plan.valor,
        fechaInicio,
        fechaFin: fin,
        observacion: tarifaForm.observacion,
        ...(tarifaForm.puestoId ? { puestoId: Number(tarifaForm.puestoId) } : {}),
      });
    }
  };

  const guardarReserva = async (clienteIdNum, vehiculoIdNum) => {
    if (!conReserva || !reservaForm.fechaInicio) return;
    if (existenteRef.current.reservaId) {
      await api.put(`/reservas/${existenteRef.current.reservaId}`, {
        fechaInicio: reservaForm.fechaInicio,
        fechaFin: reservaForm.fechaFin || undefined,
        puestoId: reservaForm.puestoId || undefined,
        observaciones: reservaForm.observaciones || undefined,
      });
    } else {
      await api.post("/reservas", {
        clienteId: clienteIdNum,
        vehiculoId: vehiculoIdNum,
        fechaInicio: reservaForm.fechaInicio,
        fechaFin: reservaForm.fechaFin || undefined,
        puestoId: reservaForm.puestoId || undefined,
        observaciones: reservaForm.observaciones || undefined,
      });
    }
  };

  const guardarIngreso = async (clienteIdNum, vehiculoIdNum) => {
    if (!conIngreso) return;
    if (existenteRef.current.ingresoId) {
      await api.put(`/ingresos/${existenteRef.current.ingresoId}`, {
        vehiculoId: vehiculoIdNum,
        puestoId: ingresoForm.puestoId ? Number(ingresoForm.puestoId) : undefined,
      });
    } else {
      await api.post("/ingresos", {
        clienteId: clienteIdNum,
        vehiculoId: vehiculoIdNum,
        puestoId: ingresoForm.puestoId ? Number(ingresoForm.puestoId) : undefined,
        tarifaId: ingresoForm.tarifaId ? Number(ingresoForm.tarifaId) : undefined,
      });
    }
  };

  const guardarCliente = async () => {
    setCargando(true);
    setErrorMsg("");
    try {
      const payload = { nombres: form.nombres, apellidos: form.apellidos, documento: form.documento, telefono: form.telefono, email: form.email, direccion: form.direccion, observaciones: form.observaciones, estado: form.estado, bloqueado: !!form.bloqueado };
      const vehiculosValidos = form.vehiculos.filter(v => v.placa && v.placa.trim());
      if (conSuscripcion && vehiculosValidos.length === 0) {
        mostrarToast("La suscripción requiere al menos un vehículo con placa.", "error");
        setCargando(false);
        return;
      }

      if (modoEdicion) {
        await api.put(`/clientes/${clienteId}`, payload);
        const cRes = await api.get(`/clientes/${clienteId}`);
        const c = cRes.data.cliente || cRes.data;
        const entrantesPlacas = vehiculosValidos.map(v => v.placa.trim().toUpperCase());
        for (const v of c.vehiculos || []) {
          if (!entrantesPlacas.includes(v.placa.toUpperCase())) {
            await api.delete(`/vehiculos/${v.id}`).catch(() => {});
          }
        }
        let primerVehId = null;
        for (const v of vehiculosValidos) {
          const placaUp = v.placa.trim().toUpperCase();
          const existente = (c.vehiculos || []).find(ev => ev.placa.toUpperCase() === placaUp);
          if (existente) {
            await api.put(`/vehiculos/${existente.id}`, { ...v, placa: placaUp });
            if (!primerVehId) primerVehId = existente.id;
          } else {
            const rv = await api.post("/vehiculos", { ...v, placa: placaUp, clienteId: Number(clienteId) });
            if (!primerVehId) primerVehId = rv.data.vehiculo.id;
          }
        }
        if (primerVehId) {
          await guardarMensualidad(Number(clienteId), primerVehId);
          await guardarReserva(Number(clienteId), primerVehId);
          await guardarIngreso(Number(clienteId), primerVehId);
        }
      } else {
        const res = await api.post("/clientes", payload);
        const nuevoCliente = res.data.cliente;
        let primerVehId = null;
        for (const v of vehiculosValidos) {
          const rv = await api.post("/vehiculos", { ...v, placa: v.placa.trim().toUpperCase(), clienteId: nuevoCliente.id });
          if (!primerVehId) primerVehId = rv.data.vehiculo.id;
        }
        if (primerVehId) {
          await guardarMensualidad(nuevoCliente.id, primerVehId);
          await guardarReserva(nuevoCliente.id, primerVehId);
          await guardarIngreso(nuevoCliente.id, primerVehId);
        }
      }
      setMostrarModal(false);
      setConSuscripcion(false);
      setTarifaForm({ planId: "", puestoId: "", observacion: "" });
      setConReserva(false);
      setReservaForm({ fechaInicio: "", fechaFin: "", puestoId: null, observaciones: "" });
      setConIngreso(false);
      setIngresoForm({ tarifaId: "", puestoId: "" });
      existenteRef.current = { mensualidadId: null, reservaId: null, ingresoId: null };
      cargarClientes();
      mostrarToast(modoEdicion ? "Cliente actualizado correctamente" : "Cliente creado correctamente", "success");
    } catch (error) {
      const data = error.response?.data;
      mostrarToast(data?.errors?.[0]?.message || data?.message || "Error al guardar cliente", "error");
    } finally {
      setCargando(false);
    }
  };

  const editarCliente = async (clienteItem) => {
    setModoEdicion(true);
    setClienteId(clienteItem.id);
    try {
      const res = await api.get(`/clientes/${clienteItem.id}`);
      const c = res.data.cliente || res.data;
      const vehs = (c.vehiculos && c.vehiculos.length > 0)
        ? c.vehiculos.map(v => ({ placa: v.placa || "", tipo: v.tipo || "", clase: v.clase || "", marca: v.marca || "", color: v.color || "", observaciones: v.observaciones || "" }))
        : [{ ...vehiculoVacio }];
      setForm({
        nombres: c.nombres || "",
        apellidos: c.apellidos || "",
        documento: c.documento || "",
        telefono: c.telefono || "",
        email: c.email || "",
        direccion: c.direccion || "",
        observaciones: c.observaciones || "",
        estado: c.estado || "ACTIVO",
        bloqueado: !!c.bloqueado,
        vehiculos: vehs,
      });

      const mensActiva = c.mensualidades?.find(m => m.estado === "ACTIVA");
      if (mensActiva) {
        setConSuscripcion(true);
        setTarifaForm({
          planId: String(mensActiva.planId || mensActiva.plan?.id || ""),
          puestoId: String(mensActiva.puestoId || mensActiva.puesto?.id || ""),
          observacion: mensActiva.observacion || "",
        });
        existenteRef.current.mensualidadId = mensActiva.id;
      } else {
        setConSuscripcion(false);
        setTarifaForm({ planId: "", puestoId: "", observacion: "" });
        existenteRef.current.mensualidadId = null;
      }

      const reservaActiva = c.reservas?.find(r => ["PENDIENTE", "CONFIRMADA", "ACTIVA"].includes(r.estado));
      if (reservaActiva) {
        setConReserva(true);
        setReservaForm({
          fechaInicio: reservaActiva.fechaInicio ? new Date(reservaActiva.fechaInicio).toISOString().slice(0, 16) : "",
          fechaFin: reservaActiva.fechaFin ? new Date(reservaActiva.fechaFin).toISOString().slice(0, 16) : "",
          puestoId: reservaActiva.puestoId,
          observaciones: reservaActiva.observaciones || "",
        });
        existenteRef.current.reservaId = reservaActiva.id;
      } else {
        setConReserva(false);
        setReservaForm({ fechaInicio: "", fechaFin: "", puestoId: null, observaciones: "" });
        existenteRef.current.reservaId = null;
      }

      const ingresoActivo = c.ingresos?.find(i => i.estado === "ACTIVO");
      if (ingresoActivo) {
        setConIngreso(true);
        setIngresoForm({ tarifaId: "", puestoId: String(ingresoActivo.puestoId || "") });
        existenteRef.current.ingresoId = ingresoActivo.id;
      } else {
        setConIngreso(false);
        setIngresoForm({ tarifaId: "", puestoId: "" });
        existenteRef.current.ingresoId = null;
      }
    } catch (e) { console.log(e); }
    setMostrarModal(true);
  };

  const eliminarCliente = async (id) => {
    try {
      const res = await api.delete(`/clientes/${id}`);
      mostrarToast(res.data.message, "success");
      cargarClientes();
    } catch (error) {
      mostrarToast(error.response?.data?.message || "Error al eliminar cliente", "error");
    }
  };

  const recargarSaldo = async () => {
    if (!recargaCli || !recargaMonto) return;
    setRecargando(true);
    try {
      await api.post(`/clientes/${recargaCli.id}/recargar-saldo`, { monto: parseFloat(recargaMonto) || 0 });
      mostrarToast("Saldo recargado correctamente", "success");
      setRecargaCli(null);
      setRecargaMonto("");
      cargarClientes();
    } catch (err) {
      mostrarToast(err.response?.data?.message || "Error al recargar saldo", "error");
    } finally { setRecargando(false); }
  };

  const confirmarEliminar = (id) => {
    setConfirm({ abierto: true, titulo: "Eliminar cliente", mensaje: "¿Estás seguro de eliminar este cliente? Se eliminarán también sus vehículos.", onConfirm: () => eliminarCliente(id) });
  };

  const abrirNuevo = () => {
    setModoEdicion(false);
    setClienteId(null);
    setForm({ ...formVacio, vehiculos: [{ ...vehiculoVacio }] });
    setConSuscripcion(false);
    setTarifaForm({ planId: "", puestoId: "", observacion: "" });
    setConReserva(false);
    setReservaForm({ fechaInicio: "", fechaFin: "", puestoId: null, observaciones: "" });
    setConIngreso(false);
    setIngresoForm({ tarifaId: "", puestoId: "" });
    setMostrarModal(true);
  };

  const clientesFiltrados = clientes;
  const contarEstado = (estado) => clientes.filter(c => c.estado === estado).length;

  return (
    <div className="min-h-screen bg-page dark:bg-slate-900 p-6 lg:p-8">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
            Gestión de Clientes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Administra perfiles y vehículos
          </p>
        </div>
        <div className="flex gap-3">
          <ExportButton data={clientesFiltrados.map(c => ({ Documento: c.documento, Nombres: c.nombres, Apellidos: c.apellidos, Teléfono: c.telefono || "", Email: c.email || "", Vehículo: c.vehiculos?.[0]?.placa || "", Plan: c.tienePlanActivo ? (c.planNombre || "Activo") : "Sin plan", Estado: c.estado }))} filename="clientes" title="Clientes" columns={[{ key: 'Documento', label: 'Documento' }, { key: 'Nombres', label: 'Nombres' }, { key: 'Apellidos', label: 'Apellidos' }, { key: 'Teléfono', label: 'Teléfono' }, { key: 'Email', label: 'Email' }, { key: 'Vehículo', label: 'Vehículo' }, { key: 'Plan', label: 'Plan' }, { key: 'Estado', label: 'Estado' }]} />
          <button onClick={() => setMostrarImportar(true)} className="inline-flex items-center gap-2 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-all">
            <Upload className="w-4 h-4" /> Importar
          </button>
          <button onClick={abrirNuevo} className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 shadow-lg shadow-teal-600/20 hover:shadow-teal-600/30 active:scale-[0.98]">
            <IconPlus /> Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {ESTADOS_CLIENTE.map((est) => (
          <div key={est.value} className={`rounded-xl border dark:border-slate-700 p-3.5 transition-transform duration-200 hover:scale-[1.02] ${est.bg} dark:bg-slate-800 ${est.border}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${est.dot}`} />
              <span className={`text-xs font-medium ${est.text} dark:text-slate-300 uppercase tracking-wide`}>{est.label}</span>
            </div>
            <p className={`text-2xl font-bold ${est.text} dark:text-white`}>{contarEstado(est.value)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {[
          { value: "", label: "Todos" },
          { value: "ACTIVO", label: "Activos" },
          { value: "AUSENTE", label: "Ausentes" },
          { value: "VENCIDO", label: "Vencidos" },
          { value: "SUSPENDIDO", label: "Suspendidos" },
          { value: "MOROSO", label: "Morosos" },
        ].map(f => (
          <button key={f.value} onClick={() => { setFiltroRapido(f.value); setPage(1); }} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${filtroRapido === f.value ? "bg-teal-600 text-white shadow-md" : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"}`}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { value: "", label: "Sin filtro" },
          { value: "CON_PLAN", label: "Con plan" },
          { value: "SIN_PLAN", label: "Sin plan" },
          { value: "CON_RESERVA", label: "Con reserva" },
          { value: "SIN_RESERVA", label: "Sin reserva" },
          { value: "CON_VEHICULO", label: "Con vehículo" },
          { value: "SIN_VEHICULO", label: "Sin vehículo" },
        ].map(f => (
          <button key={f.value} onClick={() => { setFiltroExtra(f.value); setPage(1); }} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${filtroExtra === f.value ? "bg-indigo-600 text-white shadow-md" : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 dark:bg-slate-800 mb-5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <IconSearch />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, documento o placa..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-slate-50 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800 dark:bg-slate-700">
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Documento</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Nombre</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Contacto</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Vehículo</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Reserva</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Plan</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Saldo</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Bloq.</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <IconSearch />
                      </div>
                      <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">No se encontraron clientes</p>
                      <p className="text-slate-300 dark:text-slate-500 text-xs">Intenta con otro término de búsqueda</p>
                    </div>
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors duration-150">
                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300 font-mono">{cliente.documento || "—"}</td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{cliente.nombres} {cliente.apellidos}</p>
                      {cliente.email && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[180px]">{cliente.email}</p>}
                    </td>
                    <td className="px-4 py-4">
                      {cliente.telefono ? (
                        <span className="text-sm text-slate-600 dark:text-slate-300">{cliente.telefono}</span>
                      ) : <span className="text-sm text-slate-300 dark:text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-4">
                      {cliente.vehiculos?.[0]?.placa ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5 text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">
                            <IconCar />
                            {cliente.vehiculos[0].placa}
                            {cliente.vehiculos.length > 1 && <span className="text-[10px] font-medium text-teal-600 dark:text-teal-400 ml-1">+{cliente.vehiculos.length - 1}</span>}
                          </span>
                          {cliente.vehiculos[0].marca && <span className="text-[11px] text-slate-400 dark:text-slate-500 capitalize ml-5">{cliente.vehiculos[0].marca} {cliente.vehiculos[0].color && `· ${cliente.vehiculos[0].color}`}</span>}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-300 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {cliente.reservas?.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-100 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
                          <CalendarDays className="w-3 h-3" />
                          Sí
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">No</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {cliente.tienePlanActivo ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50">
                            Sí
                          </span>
                          {cliente.tieneVencida && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400 ml-1">
                              Vencida
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">No</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={`text-sm font-semibold ${cliente.saldo > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}>
                        ${(cliente.saldo || 0).toLocaleString()}
                      </span>
                      <button onClick={() => { setRecargaCli(cliente); setRecargaMonto(""); }} className="ml-1 p-0.5 rounded text-slate-400 hover:text-emerald-600" title="Recargar saldo">
                        <Plus className="w-3 h-3 inline" />
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <EstadoBadge estado={cliente.estado} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      {cliente.bloqueado ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">SÍ</span>
                      ) : (
                        <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          to={`/clientes/${cliente.id}/perfil`}
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all" title="Perfil"
                        >
<User className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => editarCliente(cliente)}
                          className="p-2 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all" title="Editar"
                        >
                          <IconEdit />
                        </button>
                        {cliente.tienePlanActivo && (
                          <button
                            onClick={() => { setRenovarCli(cliente); setRenovarPlanId(""); }}
                            className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all" title="Renovar plan"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        {cliente.telefono && (
                          <button
                            onClick={() => {
                              const msg = encodeURIComponent(`Hola ${cliente.nombres}, te recordamos tu visita al parqueadero. Si necesitas renovar tu plan, contáctanos.`);
                              window.open(`https://wa.me/57${cliente.telefono}?text=${msg}`, "_blank");
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all" title="Enviar WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => confirmarEliminar(cliente.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="Eliminar"
                        >
                          <IconTrash />
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

      <FormModal
        open={mostrarModal}
        onClose={() => setMostrarModal(false)}
        gradient="from-emerald-600 to-teal-500"
        icon={UserPlus}
        titulo={modoEdicion ? "Editar Cliente" : "Nuevo Cliente"}
        subtitulo="Complete la información del cliente y su vehículo"
        size="max-w-2xl"
        footer={
          <>
            {errorMsg && (
              <div className="flex-1 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{errorMsg}</div>
            )}
            <button onClick={() => setMostrarModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-all duration-200">
              Cancelar
            </button>
            <button onClick={guardarCliente} disabled={cargando} className="px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-all duration-200 shadow-lg shadow-teal-600/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
              {cargando ? "Guardando..." : "Guardar Cliente"}
            </button>
          </>
        }
      >
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider mb-3">Información personal</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nombres</label>
                <input name="nombres" placeholder="Nombres del cliente" value={form.nombres} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Apellidos</label>
                <input name="apellidos" placeholder="Apellidos del cliente" value={form.apellidos} onChange={handleChange} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className={labelClass}>Documento</label>
                <input name="documento" placeholder="Número de documento" value={form.documento} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Teléfono</label>
                <input name="telefono" placeholder="Número de teléfono" value={form.telefono} onChange={handleChange} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className={labelClass}>Correo electrónico</label>
                <input name="email" type="email" placeholder="correo@ejemplo.com" value={form.email} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <SelectWithOther
                  label="Estado"
                  name="estado"
                  value={form.estado}
                  onChange={handleChange}
                  options={ESTADOS_CLIENTE.map(e => ({ value: e.value, label: e.label }))}
                  otherLabel="Otro estado"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelClass}>Dirección</label>
              <input name="direccion" placeholder="Dirección completa" value={form.direccion} onChange={handleChange} className={inputClass} />
            </div>
            <div className="mt-4">
              <label className={labelClass}>Observaciones</label>
              <textarea name="observaciones" placeholder="Notas adicionales sobre el cliente..." value={form.observaciones} onChange={handleChange} className={inputClass + " resize-none"} rows={3} />
            </div>
            {modoEdicion && (
              <div className="mt-4 flex items-center gap-3">
                <input type="checkbox" name="bloqueado" checked={form.bloqueado} onChange={handleChange} className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500/20" />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Bloquear cliente</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">No podrá registrar ingresos mientras esté bloqueado</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Vehículos (opcional)</p>
            <button type="button" onClick={agregarVehiculo} className="text-xs font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Agregar vehículo
            </button>
          </div>
          {form.vehiculos.map((v, idx) => (
            <div key={idx} className={`rounded-lg border p-3 space-y-3 ${idx > 0 ? "border-dashed" : "border-transparent bg-slate-50/50 dark:bg-slate-800/30"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Vehículo {idx + 1}</span>
                {idx > 0 && <button type="button" onClick={() => quitarVehiculo(idx)} className="text-red-500 hover:text-red-700 dark:hover:text-red-400"><IconX /></button>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Placa</label>
                  <input name={`vehiculos.${idx}.placa`} placeholder="ABC-123" value={v.placa} onChange={handleChange} className={inputClass} style={{ textTransform: "uppercase" }} />
                </div>
                <div>
                  <SelectWithOther label="Tipo" name={`vehiculos.${idx}.tipo`} value={v.tipo} onChange={handleChange} options={tiposVehiculo} otherLabel="Otro tipo" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <SelectWithOther label="Clase" name={`vehiculos.${idx}.clase`} value={v.clase} onChange={handleChange} options={CLASES_VEHICULO} otherLabel="Otra clase" />
                </div>
                <div>
                  <SelectWithOther label="Marca" name={`vehiculos.${idx}.marca`} value={v.marca} onChange={handleChange} options={MARCAS_VEHICULO} otherLabel="Otra marca" />
                </div>
                <div>
                  <label className={labelClass}>Color</label>
                  <input name={`vehiculos.${idx}.color`} placeholder="Color" value={v.color} onChange={handleChange} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Observaciones</label>
                <textarea name={`vehiculos.${idx}.observaciones`} placeholder="Detalles adicionales..." value={v.observaciones} onChange={handleChange} className={inputClass + " resize-none"} rows={1} />
              </div>
            </div>
          ))}
        </div>

        {/* ─── Opciones adicionales (Suscripción / Reserva / Ingreso) ─── */}
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Opciones adicionales</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Card Suscripción */}
            <div onClick={() => setConSuscripcion(!conSuscripcion)}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all select-none ${
                conSuscripcion
                  ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20"
                  : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-teal-300"
              }`}>
              <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  conSuscripcion ? "border-teal-500" : "border-slate-300 dark:border-slate-500"
                }`}>
                  {conSuscripcion && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                </div>
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${conSuscripcion ? "text-teal-700 dark:text-teal-300" : "text-slate-700 dark:text-slate-300"}`}>
                  Suscripción
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Plan semanal, mensual</p>
              </div>
            </div>

            {/* Card Reserva */}
            <div onClick={() => setConReserva(!conReserva)}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all select-none ${
                conReserva
                  ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20"
                  : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-rose-300"
              }`}>
              <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  conReserva ? "border-rose-500" : "border-slate-300 dark:border-slate-500"
                }`}>
                  {conReserva && <div className="w-2 h-2 rounded-full bg-rose-500" />}
                </div>
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${conReserva ? "text-rose-700 dark:text-rose-300" : "text-slate-700 dark:text-slate-300"}`}>
                  <CalendarDays className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                  Reserva
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Agendar fecha</p>
              </div>
            </div>

            {/* Card Ingreso diario */}
            <div onClick={() => setConIngreso(!conIngreso)}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all select-none ${
                conIngreso
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                  : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-emerald-300"
              }`}>
              <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  conIngreso ? "border-emerald-500" : "border-slate-300 dark:border-slate-500"
                }`}>
                  {conIngreso && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                </div>
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${conIngreso ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"}`}>
                  <svg className="w-3.5 h-3.5 inline -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18v18H3V3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m-4-4h8" /></svg>
                  Ingreso diario
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Tarifa por hora/día</p>
              </div>
            </div>
          </div>

          {/* Contenido expandido Suscripción */}
          {conSuscripcion && (
            <div className="p-3 rounded-lg border border-teal-200 dark:border-teal-700 bg-teal-50/30 dark:bg-teal-900/5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Plan</label>
                  <Select value={tarifaForm.planId} onChange={(val) => setTarifaForm(f => ({ ...f, planId: val }))} options={[
                    { value: "", label: "Seleccionar plan..." },
                    ...planes.map(p => ({ value: String(p.id), label: `${p.nombre} — $${p.valor.toLocaleString()} / ${p.duracionDias} días` })),
                  ]} placeholder="Seleccionar plan..." />
                </div>
                <div>
                  <label className={labelClass}>Puesto</label>
                  <Select value={tarifaForm.puestoId} onChange={(val) => setTarifaForm(f => ({ ...f, puestoId: val }))} options={[
                    { value: "", label: "Sin puesto" },
                    ...puestos.filter(p => p.activo && (p.estado === "LIBRE" || !p.estado)).map(p => ({ value: String(p.id), label: `${p.codigo} (${p.tipoPuesto})` })),
                  ]} placeholder="Sin puesto" />
                </div>
              </div>
              {tarifaForm.planId && (() => {
                const plan = planes.find(p => p.id === Number(tarifaForm.planId));
                if (!plan) return null;
                const hoy = new Date().toISOString().split("T")[0];
                const fin = new Date(Date.now() + plan.duracionDias * 86400000).toISOString().split("T")[0];
                return (
                  <div className="p-3 bg-white dark:bg-slate-700 rounded-lg border border-teal-200 dark:border-teal-700 text-xs space-y-1">
                    <p className="text-teal-700 dark:text-teal-300 font-medium">{plan.nombre}</p>
                    <p className="text-slate-600 dark:text-slate-400">Valor: <strong>${plan.valor.toLocaleString()}</strong> · Vigencia: {hoy} → {fin}</p>
                  </div>
                );
              })()}
              <textarea value={tarifaForm.observacion} onChange={e => setTarifaForm(f => ({ ...f, observacion: e.target.value }))} className={inputClass + " resize-none"} rows={1} placeholder="Observación (opcional)..." />
            </div>
          )}

          {/* Contenido expandido Reserva */}
          {conReserva && (
            <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-700 bg-rose-50/30 dark:bg-rose-900/5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Inicio</label>
                  <input type="datetime-local" value={reservaForm.fechaInicio} onChange={e => setReservaForm(f => ({ ...f, fechaInicio: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Fin</label>
                  <input type="datetime-local" value={reservaForm.fechaFin} onChange={e => setReservaForm(f => ({ ...f, fechaFin: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Puesto</label>
                  <Select value={reservaForm.puestoId} onChange={(val) => setReservaForm(f => ({ ...f, puestoId: val || null }))} options={[
                    { value: "", label: "Sin asignar" },
                    ...puestos.filter(p => p.activo && (p.estado === "LIBRE" || !p.estado)).map(p => ({ value: String(p.id), label: `${p.codigo} (${p.tipoPuesto})` })),
                  ]} placeholder="Sin asignar" />
                </div>
                <div>
                  <label className={labelClass}>Observaciones</label>
                  <textarea value={reservaForm.observaciones} onChange={e => setReservaForm(f => ({ ...f, observaciones: e.target.value }))} className={inputClass + " resize-none"} rows={1} placeholder="Notas..." />
                </div>
              </div>
            </div>
          )}

          {/* Contenido expandido Ingreso diario */}
          {conIngreso && (
            <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-900/5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Tarifa</label>
                  <Select value={ingresoForm.tarifaId} onChange={(val) => setIngresoForm(f => ({ ...f, tarifaId: val }))} options={[
                    { value: "", label: "Seleccionar tarifa..." },
                    ...tarifas.filter(t => !form.vehiculos[0]?.tipo || t.tipoVehiculo === "todos" || t.tipoVehiculo === form.vehiculos[0]?.tipo).map(t => ({ value: String(t.id), label: `${t.nombre} — $${t.valor.toLocaleString()} (${t.modalidad})` })),
                  ]} placeholder="Seleccionar tarifa..." />
                </div>
                <div>
                  <label className={labelClass}>Puesto</label>
                  <Select value={ingresoForm.puestoId} onChange={(val) => setIngresoForm(f => ({ ...f, puestoId: val }))} options={[
                    { value: "", label: "Seleccionar puesto..." },
                    ...puestos.filter(p => p.activo && p.estado === "LIBRE").map(p => ({ value: String(p.id), label: `${p.codigo} (${p.tipoPuesto})` })),
                  ]} placeholder="Seleccionar puesto..." />
                </div>
              </div>
            </div>
          )}
        </div>
      </FormModal>

      {/* Modal Importar */}
      {mostrarImportar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => { setMostrarImportar(false); setImportData([]); setImportResultado(null); }} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-modal-in flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Importar clientes</h3>
              <button onClick={() => { setMostrarImportar(false); setImportData([]); setImportResultado(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><IconX /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              {!importResultado ? (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Sube un archivo CSV o pega datos en formato JSON.</p>
                  <div>
                    <label className={labelClass}>Datos (CSV o JSON)</label>
                    <textarea
                      placeholder='nombres,apellidos,documento,telefono,email,placa,marca,tipo,color&#10;Juan,Perez,123456,3001234567,juan@mail.com,ABC123,Mazda,carro,rojo&#10;Maria,Gomez,789012,3009876543,maria@mail.com,DEF456,Toyota,moto,azul'
                      className={inputClass + " resize-none font-mono text-xs"} rows={8}
                      onChange={(e) => {
                        const txt = e.target.value.trim();
                        if (!txt) { setImportData([]); return; }
                        try {
                          const parsed = JSON.parse(txt);
                          if (Array.isArray(parsed)) { setImportData(parsed); return; }
                        } catch {}
                        const lines = txt.split("\n").filter(l => l.trim());
                        if (lines.length < 2) { setImportData([]); return; }
                        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
                        const rows = lines.slice(1).map(line => {
                          const vals = line.split(",").map(v => v.trim());
                          const obj = {};
                          headers.forEach((h, i) => obj[h] = vals[i] || "");
                          return obj;
                        });
                        setImportData(rows);
                      }}
                    />
                  </div>
                  {importData.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{importData.length} registro(s) detectados</p>
                      <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-slate-50 dark:bg-slate-700">
                            {Object.keys(importData[0]).map(k => <th key={k} className="px-2 py-1 text-left font-medium text-slate-600 dark:text-slate-300 capitalize">{k}</th>)}
                          </tr></thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {importData.slice(0, 10).map((row, i) => (
                              <tr key={i}>
                                {Object.values(row).map((v, j) => <td key={j} className="px-2 py-1 text-slate-700 dark:text-slate-300">{v || "—"}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${importResultado.creados > 0 ? "bg-emerald-100 dark:bg-emerald-900/20" : "bg-red-100 dark:bg-red-900/20"}`}>
                    {importResultado.creados > 0 ? <CheckCircle className="w-6 h-6 text-emerald-600" /> : <AlertTriangle className="w-6 h-6 text-red-600" />}
                  </div>
                  <p className="text-lg font-bold text-slate-800 dark:text-white">{importResultado.creados} clientes importados</p>
                  {importResultado.errores > 0 && <p className="text-sm text-red-600">{importResultado.errores} errores</p>}
                  {importResultado.detalles?.length > 0 && (
                    <div className="text-xs text-left bg-red-50 dark:bg-red-900/10 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {importResultado.detalles.map((d, i) => (
                        <p key={i} className="text-red-700 dark:text-red-400 py-0.5">{d.documento}: {d.error}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
              {!importResultado ? (
                <>
                  <button onClick={() => { setMostrarImportar(false); setImportData([]); }} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">Cancelar</button>
                  <button disabled={importData.length === 0 || importando} onClick={async () => {
                    setImportando(true);
                    try {
                      const res = await api.post("/clientes/importar", { clientes: importData });
                      setImportResultado(res.data);
                      cargarClientes();
                    } catch { mostrarToast("Error al importar", "error"); }
                    finally { setImportando(false); }
                  }} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
                    {importando ? "Importando..." : "Importar"}
                  </button>
                </>
              ) : (
                <button onClick={() => { setMostrarImportar(false); setImportData([]); setImportResultado(null); }} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">Cerrar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Renovación rápida */}
      {renovarCli && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setRenovarCli(null)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden animate-modal-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Renovar plan</h3>
              <button onClick={() => setRenovarCli(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><IconX /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Cliente: <strong className="text-slate-800 dark:text-white">{renovarCli.nombres} {renovarCli.apellidos}</strong>
              </p>
              {renovarCli.planNombre && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Plan actual: {renovarCli.planNombre}</p>
              )}
              <div>
                <label className={labelClass}>Nuevo plan</label>
                <Select value={renovarPlanId} onChange={setRenovarPlanId} options={[
                  { value: "", label: "Seleccionar plan..." },
                  ...planes.map(p => ({ value: String(p.id), label: `${p.nombre} — $${p.valor.toLocaleString()} / ${p.duracionDias} días` })),
                ]} placeholder="Seleccionar plan..." />
              </div>
              {renovarPlanId && (() => {
                const plan = planes.find(p => p.id === Number(renovarPlanId));
                if (!plan) return null;
                const hoy = new Date().toISOString().split("T")[0];
                const fin = new Date(Date.now() + plan.duracionDias * 86400000).toISOString().split("T")[0];
                return (
                  <div className="p-3 bg-teal-50 dark:bg-teal-900/10 rounded-lg border border-teal-200 dark:border-teal-700 text-xs space-y-1">
                    <p className="text-teal-700 dark:text-teal-300 font-medium">{plan.nombre}</p>
                    <p className="text-slate-600 dark:text-slate-400">Valor: <strong>${plan.valor.toLocaleString()}</strong></p>
                    <p className="text-slate-600 dark:text-slate-400">Vigencia: {hoy} → {fin}</p>
                  </div>
                );
              })()}
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setRenovarCli(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">Cancelar</button>
              <button disabled={!renovarPlanId || renovando} onClick={async () => {
                setRenovando(true);
                try {
                  const plan = planes.find(p => p.id === Number(renovarPlanId));
                  const hoy = new Date().toISOString().split("T")[0];
                  const fin = new Date(Date.now() + plan.duracionDias * 86400000).toISOString().split("T")[0];
                  await api.post("/mensualidades", {
                    clienteId: renovarCli.id,
                    vehiculoId: renovarCli.vehiculos?.[0]?.id || undefined,
                    planId: Number(renovarPlanId),
                    valor: plan.valor,
                    fechaInicio: hoy,
                    fechaFin: fin,
                  });
                  setRenovarCli(null);
                  setRenovarPlanId("");
                  cargarClientes();
                  mostrarToast("Plan renovado correctamente", "success");
                } catch { mostrarToast("Error al renovar plan", "error"); }
                finally { setRenovando(false); }
              }} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
                {renovando ? "Renovando..." : "Renovar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Recargar saldo */}
      {recargaCli && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setRecargaCli(null)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden animate-modal-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Recargar saldo</h3>
              <button onClick={() => setRecargaCli(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><IconX /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Cliente: <strong className="text-slate-800 dark:text-white">{recargaCli.nombres} {recargaCli.apellidos}</strong>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Saldo actual: <strong className="text-emerald-600 dark:text-emerald-400">${(recargaCli.saldo || 0).toLocaleString()}</strong></p>
              <div>
                <label className={labelClass}>Monto a recargar ($)</label>
                <input type="number" min="0" placeholder="0" value={recargaMonto} onChange={(e) => setRecargaMonto(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setRecargaCli(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">Cancelar</button>
              <button disabled={!recargaMonto || recargando} onClick={recargarSaldo} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {recargando ? "Recargando..." : "Recargar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
      <ConfirmDialog abierto={confirm.abierto} titulo={confirm.titulo} mensaje={confirm.mensaje} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(c => ({ ...c, abierto: false }))} />
      <ScrollLock cuando={mostrarModal || !!renovarCli || !!recargaCli} />
    </div>
  );
}

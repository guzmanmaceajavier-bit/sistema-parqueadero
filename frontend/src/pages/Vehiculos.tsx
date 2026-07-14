import { useEffect, useState, useCallback } from "react";
import { Ban, Car, Pencil, Plus, Search, X } from "lucide-react";
import FormModal from "../components/ui/FormModal";
import useDebounce from "../hooks/useDebounce";
import ScrollLock from "../components/ScrollLock";
import api from "../services/api";
import SelectWithOther from "../components/SelectWithOther";
import { MARCAS_VEHICULO } from "../constants/vehiculo";
import ExportButton from "../components/ExportButton";
import Pagination from "../components/Pagination";
import Toast from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import ClientSearch from "../components/ClientSearch";

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";

const TIPOS_VEHICULO = [
  { value: "moto", label: "Moto" },
  { value: "carro", label: "Carro" },
  { value: "camioneta", label: "Camioneta" },
  { value: "bicicleta", label: "Bicicleta" },
];

const CLASES_VEHICULO = [
  { value: "particular", label: "Particular" },
  { value: "publico", label: "Público" },
  { value: "carga", label: "Carga" },
  { value: "electrico", label: "Eléctrico" },
  { value: "deportivo", label: "Deportivo" },
  { value: "especial", label: "Especial" },
];

function IconCar() {
    return <Car className="w-4 h-4" />;
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
    return <Pencil className="w-4 h-4" />;
  }

function IconBan() {
    return <Ban className="w-4 h-4" />;
  }

function TipoBadge({ tipo }) {
  const colors = { moto: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800", carro: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800", camioneta: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800", bicicleta: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800", otro: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600" };
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${colors[tipo] || colors.otro}`}>{tipo || "otro"}</span>;
}

export default function Vehiculos() {
  const [vehiculos, setVehiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const busquedaDebounced = useDebounce(busqueda);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [vehiculoId, setVehiculoId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const [confirm, setConfirm] = useState({ abierto: false, titulo: "", mensaje: "", onConfirm: () => {} });
  const mostrarToast = useCallback((mensaje, tipo = "success") => setToast({ mensaje, tipo }), []);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const formVacio = { placa: "", marca: "", modelo: "", color: "", tipo: "carro", clase: "particular", clienteId: "", observaciones: "", bloqueado: false };
  const [form, setForm] = useState(formVacio);

  const cargarVehiculos = async (p = 1) => {
    try {
      const params = { page: p };
      if (busqueda) params.q = busqueda;
      const res = await api.get("/vehiculos", { params });
      setVehiculos(res.data.vehiculos || []);
      setPagination(res.data.pagination || {});
    } catch (error) { console.log(error); }
  };

  const cargarClientes = async () => {
    try {
      const res = await api.get("/clientes");
      setClientes(res.data.clientes || []);
    } catch (error) { console.log(error); }
  };

  useEffect(() => { cargarVehiculos(page); }, [page]);
  useEffect(() => { cargarVehiculos(1); }, [busquedaDebounced]);
  useEffect(() => { cargarClientes(); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === "placa" ? value.toUpperCase() : value }));
  };

  const guardarVehiculo = async () => {
    setCargando(true);
    setErrorMsg("");
    try {
      const payload = { placa: form.placa, marca: form.marca, modelo: form.modelo, color: form.color, tipo: form.tipo, clase: form.clase, clienteId: form.clienteId ? parseInt(form.clienteId) : null, observaciones: form.observaciones, bloqueado: !!form.bloqueado };
      if (modoEdicion) {
        await api.put(`/vehiculos/${vehiculoId}`, payload);
      } else {
        await api.post("/vehiculos", payload);
      }
      setMostrarModal(false);
      cargarVehiculos();
      mostrarToast(modoEdicion ? "Vehículo actualizado" : "Vehículo creado", "success");
    } catch (error) {
      const data = error.response?.data;
      mostrarToast(data?.errors?.[0]?.message || data?.message || "Error al guardar vehículo", "error");
    } finally { setCargando(false); }
  };

  const editarVehiculo = (v) => {
    setModoEdicion(true);
    setVehiculoId(v.id);
    setForm({ placa: v.placa || "", marca: v.marca || "", modelo: v.modelo || "", color: v.color || "", tipo: v.tipo || "carro", clase: v.clase || "particular", clienteId: v.clienteId?.toString() || "", observaciones: v.observaciones || "", bloqueado: !!v.bloqueado });
    setMostrarModal(true);
  };

  const eliminarVehiculo = async (id) => {
    try { await api.delete(`/vehiculos/${id}`); cargarVehiculos(); mostrarToast("Vehículo eliminado", "success"); } catch (error) {
      const data = error.response?.data;
      mostrarToast(data?.message || "Error al eliminar vehículo", "error");
    }
  };

  const confirmarEliminar = (id) => {
    setConfirm({ abierto: true, titulo: "Eliminar vehículo", mensaje: "¿Estás seguro de eliminar este vehículo?", onConfirm: () => eliminarVehiculo(id) });
  };

  const abrirNuevo = () => { setModoEdicion(false); setVehiculoId(null); setForm(formVacio); setMostrarModal(true); };

  const filtrados = vehiculos;

  const getClienteNombre = (id) => {
    const c = clientes.find(cl => cl.id === id);
    return c ? `${c.nombres} ${c.apellidos}` : "—";
  };

  return (
    <div className="min-h-screen bg-page dark:bg-slate-900 p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Vehículos</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Administra los vehículos registrados en el sistema</p>
        </div>
        <div className="flex gap-3">
          <ExportButton data={vehiculos.map(v => ({ Placa: v.placa, Marca: v.marca || "", Modelo: v.modelo || "", Color: v.color || "", Tipo: v.tipo || "", Clase: v.clase || "", Propietario: v.cliente ? `${v.cliente.nombres} ${v.cliente.apellidos}` : "" }))} filename="vehiculos" title="Vehículos" columns={[{ key: 'Placa', label: 'Placa' }, { key: 'Marca', label: 'Marca' }, { key: 'Modelo', label: 'Modelo' }, { key: 'Color', label: 'Color' }, { key: 'Tipo', label: 'Tipo' }, { key: 'Clase', label: 'Clase' }, { key: 'Propietario', label: 'Propietario' }]} />
          <button onClick={abrirNuevo} className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-lg shadow-teal-600/20 active:scale-[0.98]">
            <IconPlus /> Nuevo Vehículo
          </button>
        </div>
      </div>

      <div className="p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 dark:bg-slate-800 mb-5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center"><IconSearch /></div>
          <input type="text" placeholder="Buscar por placa, marca o cliente..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500" />
        </div>
      </div>

      <div className="rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800 dark:bg-slate-700">
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Placa</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Marca / Modelo</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Tipo</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Color</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Propietario</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Bloq.</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {vehiculos.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center"><p className="text-slate-400 dark:text-slate-500 text-sm">No hay vehículos registrados</p></td></tr>
              ) : (
                vehiculos.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 rounded-md border border-teal-100 dark:border-teal-800 font-mono text-sm font-bold">{v.placa}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-slate-800 dark:text-white">{v.marca || "—"}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{v.modelo || ""}</p>
                    </td>
                    <td className="px-4 py-3.5"><TipoBadge tipo={v.tipo} /></td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">{v.color || "—"}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">{getClienteNombre(v.clienteId)}</td>
                    <td className="px-4 py-3.5 text-center">
                      {v.bloqueado ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">SÍ</span>
                      ) : (
                        <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => editarVehiculo(v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 border border-teal-200 dark:border-teal-800 rounded-lg">
                          <IconEdit /> Editar
                        </button>
                        <button onClick={() => confirmarEliminar(v.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg">
                          <IconBan /> Eliminar
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
        gradient="from-violet-600 to-purple-500"
        icon={Car}
        titulo={modoEdicion ? "Editar Vehículo" : "Nuevo Vehículo"}
        subtitulo="Registra un vehículo en el sistema"
        footer={
          <>
            <div className="flex-1">
              {errorMsg && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{errorMsg}</div>
              )}
            </div>
            <button onClick={() => setMostrarModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600">Cancelar</button>
            <button onClick={guardarVehiculo} disabled={cargando} className="px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-lg shadow-teal-600/20 disabled:opacity-50 active:scale-[0.98]">
              {cargando ? "Guardando..." : "Guardar Vehículo"}
            </button>
          </>
        }
      >
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
          <div>
            <label className={labelClass}>Placa *</label>
            <input name="placa" placeholder="ABC-123" value={form.placa} onChange={handleChange} className={inputClass} style={{ textTransform: "uppercase" }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <SelectWithOther label="Marca" name="marca" value={form.marca} onChange={handleChange} options={MARCAS_VEHICULO} otherLabel="Otra marca" />
            </div>
            <div>
              <label className={labelClass}>Modelo</label>
              <input name="modelo" placeholder="2024" value={form.modelo} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <SelectWithOther label="Tipo" name="tipo" value={form.tipo} onChange={handleChange} options={TIPOS_VEHICULO} otherLabel="Otro tipo" />
            </div>
            <div>
              <SelectWithOther label="Clase" name="clase" value={form.clase} onChange={handleChange} options={CLASES_VEHICULO} otherLabel="Otra clase" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Color</label>
            <input name="color" placeholder="Rojo, Azul..." value={form.color} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Propietario</label>
            <ClientSearch value={form.clienteId} onChange={(id) => setForm({ ...form, clienteId: id?.toString() || "" })} placeholder="Buscar cliente propietario..." />
          </div>
          <div>
            <label className={labelClass}>Observaciones</label>
            <textarea name="observaciones" placeholder="Notas..." value={form.observaciones} onChange={handleChange} className={inputClass + " resize-none"} rows={2} />
          </div>
          {modoEdicion && (
            <div className="flex items-center gap-3 pt-2">
              <input type="checkbox" name="bloqueado" checked={form.bloqueado} onChange={(e) => setForm(p => ({ ...p, bloqueado: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500/20" />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Vehículo bloqueado</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">No podrá registrar ingresos</p>
              </div>
            </div>
          )}
        </div>
      </FormModal>

      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
      <ConfirmDialog abierto={confirm.abierto} titulo={confirm.titulo} mensaje={confirm.mensaje} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(c => ({ ...c, abierto: false }))} />
      <ScrollLock cuando={mostrarModal} />
    </div>
  );
}

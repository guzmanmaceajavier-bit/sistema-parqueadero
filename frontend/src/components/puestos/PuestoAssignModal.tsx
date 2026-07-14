import { X, ParkingCircle, User, Car } from "lucide-react";
import Select from "../ui/Select";
import ClientSearch from "../ClientSearch";
import { getEstadoConfig } from "./puesto.constants";

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";

export default function PuestoAssignModal({ puesto, clientes, vehiculos, form, onClose, onClientChange, onVehiculoChange, onSave }) {
  if (!puesto) return null;

  const tipos = (puesto.tipoPuesto || "").split(",").map(t => t.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-start pt-8 pb-8 px-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[95vh] flex flex-col animate-modal-in">
        <div className="relative bg-gradient-to-br from-emerald-600 to-teal-500 px-6 pt-5 pb-12 shrink-0">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white" />
            <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white" />
            <div className="absolute top-4 right-12 w-16 h-16 rounded-full bg-white" />
          </div>
          <button onClick={onClose} className="relative z-10 ml-auto block p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all">
            <X className="w-4 h-4" />
          </button>
          <div className="relative z-10 -mt-1 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
              <ParkingCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white drop-shadow-sm">Asignar Puesto {puesto.codigo}</h2>
              <div className="flex flex-wrap gap-1 mt-1">
                {tipos.map(t => (
                  <span key={t} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/20 text-white/90 capitalize">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 -mt-8 space-y-4 overflow-y-auto flex-1 pb-4 relative z-10">
          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Cliente</p>
            </div>
            <ClientSearch value={form.clienteId} onChange={(id) => onClientChange(id?.toString() || "")} placeholder="Buscar cliente..." />
            {form.clienteId && (() => {
              const c = clientes.find(cl => cl.id === parseInt(form.clienteId));
              if (!c) return null;
              return (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-600/50 rounded-lg border border-slate-100 dark:border-slate-600 text-xs space-y-1.5">
                  <div className="flex justify-between"><span className="text-slate-400 dark:text-slate-500">Doc</span><span className="font-medium text-slate-700 dark:text-slate-300">{c.documento || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 dark:text-slate-500">Tel</span><span className="font-medium text-slate-700 dark:text-slate-300">{c.telefono || "—"}</span></div>
                  {c.email && <div className="flex justify-between"><span className="text-slate-400 dark:text-slate-500">Email</span><span className="font-medium text-slate-700 dark:text-slate-300">{c.email}</span></div>}
                  {c.direccion && <div className="flex justify-between"><span className="text-slate-400 dark:text-slate-500">Dir</span><span className="font-medium text-slate-700 dark:text-slate-300">{c.direccion}</span></div>}
                </div>
              );
            })()}
          </div>

          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <Car className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Vehículo</p>
            </div>
            <Select value={form.vehiculoId} onChange={(val) => onVehiculoChange(val)} disabled={!form.clienteId} options={[
              { value: "", label: form.clienteId ? "Seleccionar vehículo" : "Primero selecciona un cliente" },
              ...(vehiculos || []).filter(v => {
                const tiposPermitidos = (puesto.tipoPuesto || "").split(",").map(t => t.trim()).filter(Boolean);
                return tiposPermitidos.length === 0 || tiposPermitidos.includes(v.tipo);
              }).map(v => ({ value: v.id.toString(), label: `${v.placa} - ${v.marca} ${v.modelo}` })),
            ]} placeholder={form.clienteId ? "Seleccionar vehículo" : "Primero selecciona un cliente"} />
            {form.vehiculoId && (() => {
              const v = vehiculos.find(ve => ve.id === parseInt(form.vehiculoId));
              if (!v) return null;
              return (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-600/50 rounded-lg border border-slate-100 dark:border-slate-600 text-xs space-y-1.5">
                  <div className="flex justify-between"><span className="text-slate-400 dark:text-slate-500">Tipo</span><span className="font-medium text-slate-700 dark:text-slate-300 capitalize">{v.tipo || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 dark:text-slate-500">Clase</span><span className="font-medium text-slate-700 dark:text-slate-300 capitalize">{v.clase || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400 dark:text-slate-500">Color</span><span className="font-medium text-slate-700 dark:text-slate-300">{v.color || "—"}</span></div>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-800">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 active:scale-[0.98] transition-all">Cancelar</button>
          <button onClick={onSave} className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 active:scale-[0.98] transition-all">
            Registrar Entrada
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { ChevronDown, X, ParkingCircle } from "lucide-react";
import SelectWithOther from "../SelectWithOther";
import { TIPOS_PUESTO, ZONAS, ESTADOS_PUESTO } from "./puesto.constants";
import { combinarTipos } from "./puesto.helpers";
import { useListas } from "../../context/ListasContext";

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";

export default function PuestoFormModal({ abierto, modoEdicion, form, tiposSeleccionados, otrosTipos, onClose, onSave, onChange, onTipoChange, onOtrosChange, cargando }) {
  const { listas } = useListas();
  const [tipoDropdown, setTipoDropdown] = useState(false);
  const tipoRef = useRef(null);

  useEffect(() => {
    if (!tipoDropdown) return;
    const cerrar = (e) => { if (tipoRef.current && !tipoRef.current.contains(e.target)) setTipoDropdown(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [tipoDropdown]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-start pt-8 pb-8 px-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[95vh] flex flex-col animate-modal-in">
        <div className="relative bg-gradient-to-br from-teal-600 to-emerald-500 px-6 pt-5 pb-12 shrink-0">
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
              <h2 className="text-lg font-bold text-white drop-shadow-sm">{modoEdicion ? "Editar Puesto" : "Nuevo Puesto"}</h2>
              <p className="text-xs text-white/80 mt-0.5">{modoEdicion ? "Modifica código, tipo, zona o estado" : "Asigna código, tipo, zona y estado"}</p>
            </div>
          </div>
        </div>

        <div className="px-6 -mt-8 space-y-4 overflow-y-auto flex-1 pb-4 relative z-10">
          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4">
            <label className={labelClass}>Código *</label>
            <input name="codigo" placeholder="Ej: A1, B12, Z-5" value={form.codigo} onChange={onChange} className={inputClass} />
          </div>

          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div ref={tipoRef}>
                <label className={labelClass}>Tipo de vehículo *</label>
                <button type="button" onClick={() => setTipoDropdown(!tipoDropdown)} className={inputClass + " text-left flex items-center justify-between gap-2"}>
                  <span className="truncate">{tiposSeleccionados.length ? combinarTipos(tiposSeleccionados, otrosTipos).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", ") : "Seleccionar..."}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${tipoDropdown ? "rotate-180" : ""}`} />
                </button>
                {tipoDropdown && (
                  <div className="mt-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 space-y-1.5 shadow-lg">
                    {listas.tiposPuesto.map(t => (
                      <label key={t.value} className="flex items-center gap-2 cursor-pointer group px-1 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-600">
                        <input type="checkbox" checked={tiposSeleccionados.includes(t.value)} onChange={() => onTipoChange(t.value)} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500/20 cursor-pointer" />
                        <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">{t.label}</span>
                      </label>
                    ))}
                    <hr className="border-slate-200 dark:border-slate-600" />
                    <input value={otrosTipos} onChange={e => onOtrosChange(e.target.value)} placeholder="Otros tipos (ej: campero, bus)" className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 placeholder:text-slate-400 bg-white dark:bg-slate-600/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20" />
                  </div>
                )}
              </div>
              <div>
                <SelectWithOther
                  label="Estado"
                  name="estado"
                  value={form.estado}
                  onChange={onChange}
                  options={ESTADOS_PUESTO.filter(e => e.value !== "OCUPADO").map(e => ({ value: e.value, label: e.label }))}
                  otherLabel="Otro estado"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4">
            <SelectWithOther label="Zona" name="zona" value={form.zona} onChange={onChange} options={listas.zonas} otherLabel="Otra zona" />
          </div>

          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4">
            <label className={labelClass}>Observación</label>
            <textarea name="observacion" placeholder="Notas..." value={form.observacion} onChange={onChange} className={inputClass + " resize-none"} rows={2} />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-800">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 active:scale-[0.98] transition-all">Cancelar</button>
          <button onClick={onSave} disabled={cargando} className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-500 rounded-xl shadow-lg shadow-teal-600/20 hover:shadow-teal-600/30 disabled:opacity-50 active:scale-[0.98] transition-all">
            {cargando ? "Guardando..." : modoEdicion ? "Guardar Cambios" : "Guardar Puesto"}
          </button>
        </div>
      </div>
    </div>
  );
}

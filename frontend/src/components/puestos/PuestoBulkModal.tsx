import { useState, useEffect, useRef } from "react";
import { ChevronDown, X, ParkingCircle, Layers } from "lucide-react";
import SelectWithOther from "../SelectWithOther";
import { TIPOS_PUESTO, ZONAS } from "./puesto.constants";
import { combinarTipos } from "./puesto.helpers";

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";

export default function PuestoBulkModal({ abierto, bulkForm, bulkTipos, bulkOtrosTipos, onClose, onSave, onChange, onTipoChange, onOtrosChange }) {
  const [bulkTipoDropdown, setBulkTipoDropdown] = useState(false);
  const bulkTipoRef = useRef(null);

  useEffect(() => {
    if (!bulkTipoDropdown) return;
    const cerrar = (e) => { if (bulkTipoRef.current && !bulkTipoRef.current.contains(e.target)) setBulkTipoDropdown(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [bulkTipoDropdown]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-start pt-8 pb-8 px-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[95vh] flex flex-col animate-modal-in">
        <div className="relative bg-gradient-to-br from-indigo-600 to-purple-500 px-6 pt-5 pb-12 shrink-0">
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
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white drop-shadow-sm">Crear Puestos Masivos</h2>
              <p className="text-xs text-white/80 mt-0.5">Varios puestos de una sola vez</p>
            </div>
          </div>
        </div>

        <div className="px-6 -mt-8 space-y-4 overflow-y-auto flex-1 pb-4 relative z-10">
          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4">
            <SelectWithOther label="Zona" name="zona" value={bulkForm.zona} onChange={e => onChange({ target: { name: "zona", value: e.target.value } })} options={ZONAS} otherLabel="Otra zona" />
          </div>

          <div ref={bulkTipoRef} className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4">
            <label className={labelClass}>Tipo de vehículo *</label>
            <button type="button" onClick={() => setBulkTipoDropdown(!bulkTipoDropdown)} className={inputClass + " text-left flex items-center justify-between gap-2"}>
              <span className="truncate">{bulkTipos.length ? combinarTipos(bulkTipos, bulkOtrosTipos).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", ") : "Seleccionar..."}</span>
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${bulkTipoDropdown ? "rotate-180" : ""}`} />
            </button>
            {bulkTipoDropdown && (
              <div className="mt-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 space-y-1.5 shadow-lg">
                {TIPOS_PUESTO.map(t => (
                  <label key={t.value} className="flex items-center gap-2 cursor-pointer group px-1 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-600">
                    <input type="checkbox" checked={bulkTipos.includes(t.value)} onChange={() => onTipoChange(t.value)} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500/20 cursor-pointer" />
                    <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">{t.label}</span>
                  </label>
                ))}
                <hr className="border-slate-200 dark:border-slate-600" />
                <input value={bulkOtrosTipos} onChange={e => onOtrosChange(e.target.value)} placeholder="Otros tipos (ej: campero, bus)" className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 placeholder:text-slate-400 bg-white dark:bg-slate-600/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20" />
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Prefijo *</label>
                <input name="prefijo" placeholder="Ej: A, B, Z1" value={bulkForm.prefijo} onChange={e => onChange({ target: { name: "prefijo", value: e.target.value } })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Cantidad *</label>
                <input name="cantidad" type="number" min={1} max={500} value={bulkForm.cantidad} onChange={e => onChange({ target: { name: "cantidad", value: Number(e.target.value) || 1 } })} className={inputClass} />
              </div>
            </div>
          </div>

          {bulkForm.zona && bulkForm.prefijo && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-700/50 p-4 text-sm text-slate-700 dark:text-slate-300 space-y-1.5">
              <p>Se crearán <strong>{bulkForm.cantidad}</strong> puestos en <strong>{bulkForm.zona}</strong></p>
              <p>Para vehículo tipo: <strong>{combinarTipos(bulkTipos, bulkOtrosTipos).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")}</strong></p>
              <p>Nombres: <strong>{bulkForm.prefijo} 1</strong>, <strong>{bulkForm.prefijo} 2</strong>...</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-800">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 active:scale-[0.98] transition-all">Cancelar</button>
          <button onClick={onSave} className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-500 rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 active:scale-[0.98] transition-all">
            Crear {bulkForm.cantidad} puestos
          </button>
        </div>
      </div>
    </div>
  );
}

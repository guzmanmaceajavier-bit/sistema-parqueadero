import { useState } from "react";
import { Plus, X, RotateCcw } from "lucide-react";
import { LISTAS_POR_DEFECTO } from "../context/ListasContext";

const inputClass = "w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all bg-white dark:bg-slate-700";

function ListaEditor({ titulo, descripcion, items, onChange, defaults }) {
  const [nuevoValue, setNuevoValue] = useState("");
  const [nuevoLabel, setNuevoLabel] = useState("");

  const addItem = () => {
    const value = nuevoValue.trim().toLowerCase().replace(/\s+/g, "-");
    const label = nuevoLabel.trim() || value.charAt(0).toUpperCase() + value.slice(1);
    if (!value) return;
    if (items.some(i => i.value === value)) return;
    onChange([...items, { value, label }]);
    setNuevoValue("");
    setNuevoLabel("");
  };

  const removeItem = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, val) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: val };
    onChange(updated);
  };

  const resetToDefaults = () => {
    onChange(defaults);
  };

  const hasChanges = JSON.stringify(items) !== JSON.stringify(defaults);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{titulo}</h3>
        {hasChanges && (
          <button onClick={resetToDefaults} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" title="Restaurar valores predeterminados">
            <RotateCcw className="w-3 h-3" /> Predeterminados
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{descripcion}</p>

      <div className="space-y-1.5 mb-4 max-h-60 overflow-y-auto">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 group">
            <input value={item.label} onChange={(e) => updateItem(idx, "label", e.target.value)} className={inputClass + " flex-1"} placeholder="Nombre" />
            <input value={item.value} onChange={(e) => updateItem(idx, "value", e.target.value.toLowerCase().replace(/\s+/g, "-"))} className={inputClass + " w-36 font-mono text-xs"} placeholder="valor" />
            <button onClick={() => removeItem(idx)} className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
        <div className="flex-1">
          <label className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1 block">Nombre</label>
          <input value={nuevoLabel} onChange={(e) => setNuevoLabel(e.target.value)} className={inputClass} placeholder="Ej: Camión" onKeyDown={(e) => e.key === "Enter" && addItem()} />
        </div>
        <div className="w-36">
          <label className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1 block">Valor</label>
          <input value={nuevoValue} onChange={(e) => setNuevoValue(e.target.value)} className={inputClass + " font-mono text-xs"} placeholder="camion" onKeyDown={(e) => e.key === "Enter" && addItem()} />
        </div>
        <button onClick={addItem} className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors shrink-0 active:scale-[0.98]">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function ListasTab({ listasForm, setListasForm, setModificado }) {
  const updateLista = (key, newItems) => {
    setListasForm(prev => ({ ...prev, [key]: newItems }));
    setModificado(true);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 lg:p-8">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Listas Personalizables</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-1">Edita las opciones que aparecen en los formularios de todo el sistema.</p>
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mt-3">
          Los cambios se aplican al guardar la configuración. Los valores en uso por registros existentes no se eliminarán automáticamente.
        </p>
      </div>

      <ListaEditor
        titulo="Tipos de Vehículo"
        descripcion="Categorías de vehículos que se pueden registrar (aparecen en Vehículos, Clientes, Tarifas y Planes)"
        items={listasForm.tiposVehiculo}
        onChange={(items) => updateLista("tiposVehiculo", items)}
        defaults={LISTAS_POR_DEFECTO.tiposVehiculo}
      />

      <ListaEditor
        titulo="Marcas de Vehículo"
        descripcion="Marcas disponibles al registrar un vehículo (aparecen en Vehículos y Clientes)"
        items={listasForm.marcasVehiculo}
        onChange={(items) => updateLista("marcasVehiculo", items)}
        defaults={LISTAS_POR_DEFECTO.marcasVehiculo}
      />

      <ListaEditor
        titulo="Clases de Vehículo"
        descripcion="Clasificación del uso del vehículo (aparecen en Vehículos y Clientes)"
        items={listasForm.clasesVehiculo}
        onChange={(items) => updateLista("clasesVehiculo", items)}
        defaults={LISTAS_POR_DEFECTO.clasesVehiculo}
      />

      <ListaEditor
        titulo="Tipos de Puesto"
        descripcion="Categorías de puestos del parqueadero (aparecen en Puestos)"
        items={listasForm.tiposPuesto}
        onChange={(items) => updateLista("tiposPuesto", items)}
        defaults={LISTAS_POR_DEFECTO.tiposPuesto}
      />

      <ListaEditor
        titulo="Zonas"
        descripcion="Zonas del parqueadero para agrupar puestos (aparecen en Puestos)"
        items={listasForm.zonas}
        onChange={(items) => updateLista("zonas", items)}
        defaults={LISTAS_POR_DEFECTO.zonas}
      />

      <ListaEditor
        titulo="Categorías de Gasto"
        descripcion="Categorías para clasificar los gastos (aparecen en Gastos)"
        items={listasForm.categoriasGasto}
        onChange={(items) => updateLista("categoriasGasto", items)}
        defaults={LISTAS_POR_DEFECTO.categoriasGasto}
      />
    </div>
  );
}

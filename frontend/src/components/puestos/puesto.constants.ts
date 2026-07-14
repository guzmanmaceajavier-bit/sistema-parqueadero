export const TIPOS_PUESTO = [
  { value: "carro", label: "Carro" },
  { value: "moto", label: "Moto" },
  { value: "camioneta", label: "Camioneta" },
  { value: "bicicleta", label: "Bicicleta" },
  { value: "discapacitado", label: "Discapacitado" },
  { value: "carga", label: "Carga" },
];

export const ZONAS = [
  { value: "Zona A", label: "Zona A" },
  { value: "Zona B", label: "Zona B" },
  { value: "Zona C", label: "Zona C" },
  { value: "Zona D", label: "Zona D" },
  { value: "Zona E", label: "Zona E" },
  { value: "Zona VIP", label: "Zona VIP" },
  { value: "Zona Carga", label: "Zona Carga" },
  { value: "Zona Visitantes", label: "Zona Visitantes" },
];

export const ESTADOS_PUESTO = [
  { value: "LIBRE", label: "Libre", bg: "bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", hover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/40" },
  { value: "OCUPADO", label: "Ocupado", bg: "bg-red-50/80 dark:bg-red-900/20 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400", dot: "bg-red-500", text: "text-red-700 dark:text-red-400", hover: "hover:bg-red-100 dark:hover:bg-red-900/40" },
  { value: "RESERVADO", label: "Reservado", bg: "bg-amber-50/80 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", hover: "hover:bg-amber-100 dark:hover:bg-amber-900/40" },
  { value: "MANTENIMIENTO", label: "Mantenimiento", bg: "bg-slate-100/80 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300", dot: "bg-slate-400", text: "text-slate-600 dark:text-slate-300", hover: "hover:bg-slate-200 dark:hover:bg-slate-600" },
  { value: "AUSENCIA", label: "Ausencia", bg: "bg-purple-50/80 dark:bg-purple-900/20 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-400", dot: "bg-purple-500", text: "text-purple-700 dark:text-purple-400", hover: "hover:bg-purple-100 dark:hover:bg-purple-900/40" },
];

export function getEstadoConfig(estado) {
  return ESTADOS_PUESTO.find(e => e.value === estado) || ESTADOS_PUESTO[0];
}

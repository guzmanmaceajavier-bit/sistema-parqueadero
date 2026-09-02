import { useState } from "react";
import Card from "../ui/Card";
import { LayoutGrid } from "lucide-react";

interface Puesto {
  id: number;
  codigo: string;
  estado: string;
  zona?: string;
  tipoPuesto?: string;
  ingresoActual?: { fechaEntrada?: string };
  vehiculo?: { placa?: string };
}

const ESTADO_CFG: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  LIBRE: { bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  OCUPADO: { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-300 dark:border-red-700", text: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
  RESERVADO: { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-300 dark:border-amber-700", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  MANTENIMIENTO: { bg: "bg-slate-100 dark:bg-slate-800", border: "border-slate-300 dark:border-slate-600", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" },
};

export default function OcupacionDashboard({ puestos, loading }: { puestos: Puesto[]; loading: boolean }) {
  const [zonaSel, setZonaSel] = useState("");
  const zonas = [...new Set(puestos.map((p) => p.zona).filter(Boolean))].sort() as string[];
  const filtrados = zonaSel ? puestos.filter((p) => p.zona === zonaSel) : puestos;

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12 text-slate-400">
          <div className="animate-spin w-5 h-5 border-2 border-slate-300 border-t-teal-500 rounded-full mr-2" />
          <span className="text-sm">Cargando puestos...</span>
        </div>
      </Card>
    );
  }
  if (puestos.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
          <LayoutGrid className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm font-medium">Crea puestos para ver la ocupación</p>
        </div>
      </Card>
    );
  }

  const stats = {
    libres: filtrados.filter(p => p.estado === "LIBRE").length,
    ocupados: filtrados.filter(p => p.estado === "OCUPADO").length,
    reservados: filtrados.filter(p => p.estado === "RESERVADO").length,
    mantenimiento: filtrados.filter(p => p.estado === "MANTENIMIENTO").length,
  };
  const pct = filtrados.length > 0 ? Math.round(((stats.ocupados + stats.reservados) / filtrados.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {zonas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setZonaSel("")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              !zonaSel ? "bg-teal-500 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}>Todas</button>
          {zonas.map((z) => (
            <button key={z} onClick={() => setZonaSel(z)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                zonaSel === z ? "bg-teal-500 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}>{z}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-medium">Libres</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.libres}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-600 dark:text-red-400 uppercase font-medium">Ocupados</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.ocupados}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-600 dark:text-amber-400 uppercase font-medium">Reservados</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.reservados}</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500 uppercase font-medium">Mtto.</p>
          <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{stats.mantenimiento}</p>
        </div>
        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border border-teal-200 dark:border-teal-800 col-span-2 sm:col-span-1">
          <p className="text-xs text-teal-600 dark:text-teal-400 uppercase font-medium">Ocupación</p>
          <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{pct}%</p>
          <div className="mt-2 h-1.5 bg-teal-200 dark:bg-teal-800 rounded-full overflow-hidden">
            <div className="h-full bg-teal-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5">
        {filtrados.map((p) => {
          const c = ESTADO_CFG[p.estado] || ESTADO_CFG.LIBRE;
          const diff = p.ingresoActual?.fechaEntrada ? Math.floor((Date.now() - new Date(p.ingresoActual.fechaEntrada).getTime()) / 60000) : 0;
          const horas = Math.floor(diff / 60);
          const mins = diff % 60;
          return (
            <div key={p.id} className={`rounded-xl border-2 ${c.bg} ${c.border} p-3 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-default`}>
              <div className="flex items-center justify-between">
                <span className={`text-base font-bold ${c.text}`}>{p.codigo}</span>
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
              </div>
              {p.estado === "OCUPADO" && (
                <div className="mt-1 space-y-0.5">
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{p.vehiculo?.placa || "—"}</div>
                  <div className="text-[10px] text-slate-400">{horas}h {mins}min</div>
                </div>
              )}
              {p.estado === "LIBRE" && <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">Disponible</div>}
              {p.estado === "RESERVADO" && <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">Reservado</div>}
              {p.estado === "MANTENIMIENTO" && <div className="text-[11px] text-slate-500 mt-1">Mtto.</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

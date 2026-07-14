import { useState, useEffect } from "react";
import { Car, Circle, Clock, AlertTriangle, RefreshCw, Layers } from "lucide-react";
import api from "../services/api";

interface Puesto {
  id: number;
  codigo: string;
  estado: string;
  tipoPuesto: string;
  zona: string | null;
  vehiculo?: { placa: string; marca?: string; modelo?: string };
  ingresoActual?: { fechaEntrada: string };
}

interface Agrupado {
  zona: string;
  puestos: Puesto[];
  libres: number;
  ocupados: number;
  reservados: number;
  ausencias: number;
  mantenimiento: number;
  total: number;
}

const ESTADO_CFG: Record<string, { label: string; bg: string; border: string; text: string; icon: string; dot: string }> = {
  libre: { label: "Libre", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-700 dark:text-emerald-300", icon: "text-emerald-500", dot: "bg-emerald-500" },
  ocupado: { label: "Ocupado", bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-300 dark:border-red-700", text: "text-red-700 dark:text-red-300", icon: "text-red-500", dot: "bg-red-500" },
  reservado: { label: "Reservado", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-300 dark:border-amber-700", text: "text-amber-700 dark:text-amber-300", icon: "text-amber-500", dot: "bg-amber-500" },
  mantenimiento: { label: "Mtto.", bg: "bg-slate-100 dark:bg-slate-800", border: "border-slate-300 dark:border-slate-600", text: "text-slate-600 dark:text-slate-400", icon: "text-slate-400", dot: "bg-slate-400" },
  ausencia: { label: "Ausencia", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-300 dark:border-purple-700", text: "text-purple-700 dark:text-purple-300", icon: "text-purple-500", dot: "bg-purple-500" },
};

function calcularTiempo(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}min`;
}

function MiniBarra({ pct }: { pct: number }) {
  const color = pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function Ocupacion() {
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [vista, setVista] = useState<"zona" | "todas">("zona");

  const cargar = async () => {
    try {
      const res = await api.get("/puestos", { params: { limit: 500 } });
      setPuestos(res.data.puestos || res.data.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); const id = setInterval(cargar, 5000); return () => clearInterval(id); }, []);

  const filtrados = filtro ? puestos.filter(p => p.estado === filtro) : puestos;

  const stats = {
    libres: puestos.filter(p => p.estado === "LIBRE").length,
    ocupados: puestos.filter(p => p.estado === "OCUPADO").length,
    reservados: puestos.filter(p => p.estado === "RESERVADO").length,
    mantenimiento: puestos.filter(p => p.estado === "MANTENIMIENTO").length,
    ausencias: puestos.filter(p => p.estado === "AUSENCIA").length,
    total: puestos.length,
  };
  const pctOcupacion = stats.total > 0 ? Math.round(((stats.ocupados + stats.reservados) / stats.total) * 100) : 0;

  const zonasMap = new Map<string, Puesto[]>();
  filtrados.forEach(p => {
    const z = p.zona || "Sin zona";
    if (!zonasMap.has(z)) zonasMap.set(z, []);
    zonasMap.get(z)!.push(p);
  });
  const agrupados: Agrupado[] = Array.from(zonasMap.entries())
    .map(([zona, pts]) => ({
      zona,
      puestos: pts,
      libres: pts.filter(p => p.estado === "LIBRE").length,
      ocupados: pts.filter(p => p.estado === "OCUPADO").length,
      reservados: pts.filter(p => p.estado === "RESERVADO").length,
      ausencias: pts.filter(p => p.estado === "AUSENCIA").length,
      mantenimiento: pts.filter(p => p.estado === "MANTENIMIENTO").length,
      total: pts.length,
    }))
    .sort((a, b) => {
      if (a.zona === "Sin zona") return 1;
      if (b.zona === "Sin zona") return -1;
      return a.zona.localeCompare(b.zona);
    });

  if (loading) return <div className="p-8 text-center text-slate-400 dark:text-slate-500">Cargando puestos...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto dark:bg-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Ocupación</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Mapa en tiempo real del parqueadero</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex p-0.5">
            <button onClick={() => setVista("todas")} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${vista === "todas" ? "bg-teal-600 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}>Todas</button>
            <button onClick={() => setVista("zona")} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${vista === "zona" ? "bg-teal-600 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              <Layers size={12} className="inline mr-1" />Zonas
            </button>
          </div>
          <button onClick={cargar} className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800 col-span-1">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-medium">Libres</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{stats.libres}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800 col-span-1">
          <p className="text-xs text-red-600 dark:text-red-400 uppercase font-medium">Ocupados</p>
          <p className="text-xl font-bold text-red-700 dark:text-red-300">{stats.ocupados}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800 col-span-1">
          <p className="text-xs text-amber-600 dark:text-amber-400 uppercase font-medium">Reservados</p>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{stats.reservados}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800 col-span-1">
          <p className="text-xs text-purple-600 dark:text-purple-400 uppercase font-medium">Ausencias</p>
          <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{stats.ausencias}</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 col-span-1">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Mtto.</p>
          <p className="text-xl font-bold text-slate-600 dark:text-slate-300">{stats.mantenimiento}</p>
        </div>
        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border border-teal-200 dark:border-teal-800 col-span-3 sm:col-span-1">
          <p className="text-xs text-teal-600 dark:text-teal-400 uppercase font-medium">Ocupación</p>
          <p className="text-xl font-bold text-teal-700 dark:text-teal-300">{pctOcupacion}%</p>
          <MiniBarra pct={pctOcupacion} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFiltro("")} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${!filtro ? "bg-slate-800 dark:bg-slate-600 text-white border-slate-800" : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"}`}>
          Todos ({stats.total})
        </button>
        {Object.entries(ESTADO_CFG).map(([key, cfg]) => (
          <button key={key} onClick={() => setFiltro(key.toUpperCase())} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${filtro === key.toUpperCase() ? `${cfg.bg} ${cfg.text} ${cfg.border}` : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1.5`} />
            {cfg.label}
          </button>
        ))}
      </div>

      {vista === "zona" ? (
        <div className="space-y-6">
          {agrupados.map(grupo => (
            <div key={grupo.zona}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-teal-500" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{grupo.zona}</h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500">({grupo.total} puestos)</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{grupo.libres} libres</span>
                  <span className="text-red-600 dark:text-red-400 font-medium">{grupo.ocupados} ocup.</span>
                  {grupo.reservados > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{grupo.reservados} res.</span>}
                  {grupo.ausencias > 0 && <span className="text-purple-600 dark:text-purple-400 font-medium">{grupo.ausencias} aus.</span>}
                  {grupo.mantenimiento > 0 && <span className="text-slate-500 dark:text-slate-400 font-medium">{grupo.mantenimiento} mtto.</span>}
                  <div className="w-20">
                    <MiniBarra pct={grupo.total > 0 ? Math.round(((grupo.ocupados + grupo.reservados) / grupo.total) * 100) : 0} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
                {grupo.puestos.map(p => {
                  const c = ESTADO_CFG[p.estado.toLowerCase()] || ESTADO_CFG.libre;
                  return (
                    <div key={p.id} className={`rounded-xl border-2 ${c.bg} ${c.border} p-2.5 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-default`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-base font-bold ${c.text}`}>{p.codigo}</span>
                      {p.estado === "OCUPADO" ? <Car size={16} className={c.icon} /> :
                       p.estado === "RESERVADO" ? <Clock size={16} className={c.icon} /> :
                       p.estado === "MANTENIMIENTO" ? <AlertTriangle size={16} className={c.icon} /> :
                       p.estado === "AUSENCIA" ? <AlertTriangle size={16} className={c.icon} /> :
                       <Circle size={16} className={c.icon} />}
                      </div>
                      {p.tipoPuesto && <div className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">{p.tipoPuesto}</div>}
                      {p.estado === "OCUPADO" && (
                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 space-y-0.5">
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{p.vehiculo?.placa || "—"}</div>
                          {p.vehiculo?.marca && <div className="truncate">{p.vehiculo.marca}</div>}
                          {p.ingresoActual?.fechaEntrada && <div className="text-[10px] text-slate-400 dark:text-slate-500">{calcularTiempo(p.ingresoActual.fechaEntrada)}</div>}
                        </div>
                      )}
                      {p.estado === "RESERVADO" && <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">Reservado</div>}
                      {p.estado === "MANTENIMIENTO" && <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Mantenimiento</div>}
                      {p.estado === "AUSENCIA" && <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 font-medium">Ausencia</div>}
                      {p.estado === "LIBRE" && <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">Disponible</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {filtrados.map(p => {
            const c = ESTADO_CFG[p.estado.toLowerCase()] || ESTADO_CFG.libre;
            return (
              <div key={p.id} className={`rounded-xl border-2 ${c.bg} ${c.border} p-3 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-default`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-lg font-bold ${c.text}`}>{p.codigo}</span>
                  {p.estado === "OCUPADO" ? <Car size={18} className={c.icon} /> :
                   p.estado === "RESERVADO" ? <Clock size={18} className={c.icon} /> :
                   p.estado === "MANTENIMIENTO" ? <AlertTriangle size={18} className={c.icon} /> :
                   p.estado === "AUSENCIA" ? <AlertTriangle size={18} className={c.icon} /> :
                   <Circle size={18} className={c.icon} />}
                </div>
                {p.zona && <div className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 inline-block mb-1">{p.zona}</div>}
                {p.tipoPuesto && <div className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">{p.tipoPuesto}</div>}
                {p.estado === "OCUPADO" && (
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 space-y-0.5">
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{p.vehiculo?.placa || "—"}</div>
                    {p.vehiculo?.marca && <div className="truncate">{p.vehiculo.marca}</div>}
                    {p.ingresoActual?.fechaEntrada && <div className="text-[11px] text-slate-400 dark:text-slate-500">{calcularTiempo(p.ingresoActual.fechaEntrada)}</div>}
                  </div>
                )}
                {p.estado === "RESERVADO" && <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">Reservado</div>}
                {p.estado === "MANTENIMIENTO" && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Mantenimiento</div>}
                {p.estado === "AUSENCIA" && <div className="text-xs text-purple-600 dark:text-purple-400 mt-1 font-medium">Ausencia</div>}
                {p.estado === "LIBRE" && <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">Disponible</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

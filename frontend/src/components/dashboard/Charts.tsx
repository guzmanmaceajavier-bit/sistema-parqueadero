import Card from "../ui/Card";
import { TrendingUp, BarChart3, Bike, Truck, Car } from "lucide-react";

interface BarData {
  label: string;
  total: number;
  gasto: number;
}

interface HourlyData {
  hora: string;
  count: number;
  x?: number;
}

interface VehicleType {
  tipo: string;
  count: number;
}

export function WeeklyChart({ bars, maxBar, ingresosSemana, ingresosMes }: { bars: BarData[]; maxBar: number; ingresosSemana: number; ingresosMes: number }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Analytics</p>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Ingresos Semanales</h3>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">${ingresosSemana.toLocaleString()}</p>
          <p className="text-[11px] text-slate-400">Semana · Mes: ${ingresosMes.toLocaleString()}</p>
        </div>
      </div>
      {bars.some((b) => b.total > 0) ? (
        <div className="relative">
          <svg className="w-full h-36" viewBox="0 0 700 140" preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="gastoGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {(() => {
              const w = 700 / bars.length;
              const h = 120;
              const pts = bars.map((b, i) => ({ x: i * w + w / 2, y: h - (b.total / maxBar) * h }));
              const ptsGasto = bars.map((b, i) => ({ x: i * w + w / 2, y: h - (b.gasto / maxBar) * h }));
              const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
              const area = `${line} L${pts[pts.length - 1].x},${h} L${pts[0].x},${h} Z`;
              const lineGasto = ptsGasto.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
              const areaGasto = `${lineGasto} L${ptsGasto[ptsGasto.length - 1].x},${h} L${ptsGasto[0].x},${h} Z`;
              return (
                <>
                  <path d={area} fill="url(#areaGrad)" />
                  <path d={line} fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="4" fill="#14b8a6" stroke="white" strokeWidth="2" />
                  ))}
                  {bars.some(b => b.gasto > 0) && (
                    <>
                      <path d={areaGasto} fill="url(#gastoGrad)" />
                      <path d={lineGasto} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4,3" />
                      {ptsGasto.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#ef4444" stroke="white" strokeWidth="1.5" />
                      ))}
                    </>
                  )}
                </>
              );
            })()}
          </svg>
          <div className="flex justify-between mt-1">
            {bars.map((b, i) => (
              <span key={i} className="text-[10px] text-slate-400 dark:text-slate-500 text-center flex-1">{b.label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-32 text-slate-400 dark:text-slate-500">
          <TrendingUp className="w-7 h-7 mb-2 opacity-30" />
          <p className="text-sm font-medium">Sin datos de ingresos esta semana</p>
          <p className="text-xs mt-1">Registra ingresos para ver la grafica</p>
        </div>
      )}
      {bars.some((b) => b.gasto > 0) && (
        <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded bg-teal-500" /> Ingresos</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-red-400" style={{ height: "2px", borderTop: "1.5px dashed #ef4444", background: "none" }} /> Gastos</span>
        </div>
      )}
    </Card>
  );
}

export function HourlyChart({ ingresosPorHora, maxHora }: { ingresosPorHora: HourlyData[]; maxHora: number }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Horas</p>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Entradas del Dia</h3>
        </div>
        <BarChart3 className="w-4 h-4 text-slate-300 dark:text-slate-600" />
      </div>
      {ingresosPorHora.some((h) => h.count > 0) ? (
        <div className="relative">
          <svg className="w-full h-28" viewBox="0 0 700 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="entradasGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {(() => {
              const data = ingresosPorHora.filter((_, i) => i % 2 === 0 || i === 23);
              const totalH = data.length;
              const h = 85;
              const spaced = data.map((d, i) => ({ x: totalH > 1 ? (i / (totalH - 1)) * 700 : 350, y: h - (d.count / maxHora) * h }));
              const line = spaced.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
              const area = `${line} L${spaced[spaced.length - 1].x},${h} L${spaced[0].x},${h} Z`;
              return (
                <>
                  <path d={area} fill="url(#entradasGrad)" />
                  <path d={line} fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {spaced.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#14b8a6" stroke="white" strokeWidth="2" />
                  ))}
                </>
              );
            })()}
          </svg>
          <div className="flex justify-between mt-1">
            {ingresosPorHora.filter((_, i) => i % 2 === 0 || i === 23).map((h, i) => (
              <span key={i} className="text-[9px] text-slate-400 dark:text-slate-500 text-center flex-1">{h.hora.slice(0, 2)}:00</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-24 text-slate-400 dark:text-slate-500">
          <BarChart3 className="w-6 h-6 mb-1 opacity-30" />
          <p className="text-xs">Sin entradas hoy</p>
        </div>
      )}
    </Card>
  );
}

export function VehicleTypeChart({ vehiculosTipo, maxTipo }: { vehiculosTipo: VehicleType[]; maxTipo: number }) {
  const tipoIconos: Record<string, React.ComponentType<{ className?: string }>> = { carro: Car, moto: Bike, camioneta: Truck, bicicleta: Bike, otro: Car };
  const colors: Record<string, { bg: string; bar: string; text: string; icon: string }> = {
    carro: { bg: "bg-blue-50 dark:bg-blue-900/20", bar: "bg-gradient-to-r from-blue-500 to-blue-400", text: "text-blue-700 dark:text-blue-300", icon: "text-blue-500 dark:text-blue-400" },
    moto: { bg: "bg-emerald-50 dark:bg-emerald-900/20", bar: "bg-gradient-to-r from-emerald-500 to-emerald-400", text: "text-emerald-700 dark:text-emerald-300", icon: "text-emerald-500 dark:text-emerald-400" },
    camioneta: { bg: "bg-violet-50 dark:bg-violet-900/20", bar: "bg-gradient-to-r from-violet-500 to-violet-400", text: "text-violet-700 dark:text-violet-300", icon: "text-violet-500 dark:text-violet-400" },
    bicicleta: { bg: "bg-amber-50 dark:bg-amber-900/20", bar: "bg-gradient-to-r from-amber-500 to-amber-400", text: "text-amber-700 dark:text-amber-300", icon: "text-amber-500 dark:text-amber-400" },
    otro: { bg: "bg-slate-50 dark:bg-slate-900/20", bar: "bg-gradient-to-r from-slate-500 to-slate-400", text: "text-slate-700 dark:text-slate-300", icon: "text-slate-500 dark:text-slate-400" },
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Flota</p>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Vehiculos por Tipo</h3>
        </div>
        <Car className="w-4 h-4 text-slate-300 dark:text-slate-600" />
      </div>
      {vehiculosTipo.length > 0 ? (
        <div className="space-y-4">
          {vehiculosTipo.map((t) => {
            const Icon = tipoIconos[t.tipo] || Car;
            const pct = Math.round((t.count / maxTipo) * 100);
            const c = colors[t.tipo] || colors.carro;
            return (
              <div key={t.tipo} className={`${c.bg} rounded-xl p-3 border border-transparent`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${c.bg}`}>
                      <Icon className={`w-4 h-4 ${c.icon}`} />
                    </div>
                    <span className={`text-sm font-semibold ${c.text} capitalize`}>{t.tipo}</span>
                  </div>
                  <span className="text-lg font-bold text-slate-800 dark:text-white">{t.count.toLocaleString()}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`}
                    style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
          <Car className="w-6 h-6 mb-2 opacity-30" />
          <p className="text-xs font-medium">Sin vehiculos registrados</p>
        </div>
      )}
    </Card>
  );
}

import { useMemo } from "react";

interface Movimiento {
  id: number;
  tipo: string;
  monto: number;
  concepto: string;
  createdAt: string;
}

export default function GraficoCaja({ movimientos }: { movimientos: Movimiento[] }) {
  const barras = useMemo(() => {
    if (!movimientos?.length) return [];
    const agrupado: Record<string, { ingresos: number; egresos: number }> = {};
    movimientos.forEach((m) => {
      const hora = new Date(m.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hourCycle: "h12" });
      if (!agrupado[hora]) agrupado[hora] = { ingresos: 0, egresos: 0 };
      if (m.tipo === "INGRESO") agrupado[hora].ingresos += m.monto;
      else agrupado[hora].egresos += m.monto;
    });
    return Object.entries(agrupado).slice(-12).map(([hora, vals]) => ({ hora, ...vals }));
  }, [movimientos]);

  if (!barras.length) return null;

  const maxVal = Math.max(...barras.flatMap((b) => [b.ingresos, b.egresos]), 1);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
      <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">Movimientos por hora</h3>
      <div className="flex items-end gap-2 h-32">
        {barras.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full flex flex-col items-center" style={{ height: "100px" }}>
              <div
                className="w-full bg-emerald-500 rounded-t transition-all"
                style={{ height: `${(b.ingresos / maxVal) * 100}px`, maxHeight: "70px" }}
                title={`Ingresos: $${b.ingresos.toLocaleString()}`}
              />
              <div
                className="w-full bg-red-400 rounded-t transition-all"
                style={{ height: `${(b.egresos / maxVal) * 100}px`, maxHeight: "30px" }}
                title={`Egresos: $${b.egresos.toLocaleString()}`}
              />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{b.hora}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Ingresos</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-400" /> Egresos</span>
      </div>
    </div>
  );
}

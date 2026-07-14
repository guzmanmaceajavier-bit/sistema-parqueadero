import { useState, useEffect, useCallback } from "react";
import { BarChart3, DollarSign, TrendingUp, TrendingDown, Download, FileText, Calendar, Car, CreditCard, Banknote, Landmark, Receipt } from "lucide-react";
import api from "../services/api";
import Card from "../components/ui/Card";
import { formatCurrency, formatDate } from "../utils/formatters";
import ExportButton from "../components/ExportButton";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

const inputClass = "px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500";
const $ = (v) => formatCurrency(v);

const PRESETS = [
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Esta Semana" },
  { key: "mes", label: "Este Mes" },
  { key: "personalizado", label: "Personalizado" },
];

export default function Reportes() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState("mes");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  useEffect(() => {
    const now = new Date();
    let inicio, fin;
    if (preset === "hoy") {
      inicio = now.toISOString().slice(0, 10);
      fin = inicio;
    } else if (preset === "semana") {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      inicio = d.toISOString().slice(0, 10);
      fin = now.toISOString().slice(0, 10);
    } else if (preset === "mes") {
      inicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      fin = now.toISOString().slice(0, 10);
    }
    if (inicio) { setFechaInicio(inicio); setFechaFin(fin); }
  }, [preset]);

  const cargar = useCallback(async () => {
    if (!fechaInicio || !fechaFin) return;
    setLoading(true);
    try {
      const res = await api.get("/reportes", { params: { fechaInicio, fechaFin } });
      setData(res.data);
    } catch {} finally { setLoading(false); }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { cargar(); }, [cargar]);

  const exportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Reporte de Estadísticas", 14, 20);
    doc.setFontSize(10);
    doc.text(`Periodo: ${fechaInicio} al ${fechaFin}`, 14, 28);
    doc.setFontSize(12);
    doc.text(`Ingresos: ${$(data.resumen.ingresos)}`, 14, 38);
    doc.text(`Gastos: ${$(data.resumen.gastos)}`, 14, 46);
    doc.text(`Utilidad: ${$(data.resumen.utilidad)}`, 14, 54);
    if (data.facturas.length > 0) {
      doc.text("Facturas", 14, 66);
      doc.autoTable({
        startY: 70,
        head: [["#", "Cliente", "Placa", "Valor", "Método", "Fecha"]],
        body: data.facturas.map(f => [f.numero, f.cliente || "—", f.placa || "—", $(f.valor), f.metodoPago || "—", formatDate(f.createdAt)]),
      });
    }
    if (data.gastos.length > 0) {
      const y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 120;
      doc.text("Gastos", 14, y);
      doc.autoTable({
        startY: y + 4,
        head: [["Concepto", "Categoría", "Valor", "Fecha"]],
        body: data.gastos.map(g => [g.concepto, g.categoria || "—", $(g.valor), formatDate(g.fecha)]),
      });
    }
    doc.save(`reporte-${fechaInicio}-al-${fechaFin}.pdf`);
  };

  const d = data || {};
  const resumen = d.resumen || {};
  const ingresosPorDia = Array.isArray(d.ingresosPorDia) ? d.ingresosPorDia : [];
  const ocupacionHoras = Array.isArray(d.ocupacionPorHora) ? d.ocupacionPorHora : [];
  const metodosPago = d.metodosPago && typeof d.metodosPago === "object" ? Object.entries(d.metodosPago).map(([k, v]) => ({ metodo: k, ...v })) : [];

  const maxDia = Math.max(...ingresosPorDia.map(i => Math.max(i.ingresos, i.gastos)), 1);
  const maxHora = Math.max(...ocupacionHoras.map(h => h.count), 1);
  const maxMetodo = metodosPago.length > 0 ? Math.max(...metodosPago.map(m => m.total || 0), 1) : 1;
  const pctOcupacion = resumen.puestos?.total > 0 ? Math.round(((resumen.puestos?.ocupados || 0) / resumen.puestos?.total) * 100) : 0;

  const metodoIconos = { Efectivo: Banknote, Tarjeta: CreditCard, Transferencia: Landmark };
  const metodoColores = { Efectivo: "bg-emerald-500", Tarjeta: "bg-blue-500", Transferencia: "bg-violet-500" };

  return (
    <div className="min-h-screen bg-page dark:bg-slate-900 p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Reportes y Estadísticas</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Visualiza y exporta datos del parqueadero</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportPDF} disabled={loading || !data}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all">
            <FileText className="w-4 h-4" /> PDF
          </button>
          <ExportButton
            data={(d.facturas || []).map(f => ({ Numero: f.numero, Cliente: f.cliente || "—", Placa: f.placa || "—", Valor: $(f.valor), Metodo: f.metodoPago || "—", Fecha: formatDate(f.createdAt) }))}
            filename={`facturas-${fechaInicio}-al-${fechaFin}`}
            title="Facturas"
            columns={[{ key: 'Numero', label: '#' }, { key: 'Cliente', label: 'Cliente' }, { key: 'Placa', label: 'Placa' }, { key: 'Valor', label: 'Valor' }, { key: 'Metodo', label: 'Método' }, { key: 'Fecha', label: 'Fecha' }]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => setPreset(p.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              preset === p.key
                ? "bg-teal-500 text-white shadow-sm"
                : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
            }`}>
            {p.label}
          </button>
        ))}
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-600 mx-1" />
        <input type="date" value={fechaInicio} onChange={e => { setPreset("personalizado"); setFechaInicio(e.target.value); }} className={inputClass} />
        <span className="text-slate-400 text-sm">a</span>
        <input type="date" value={fechaFin} onChange={e => { setPreset("personalizado"); setFechaFin(e.target.value); }} className={inputClass} />
        <button onClick={cargar} disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-all">
          {loading ? "Cargando..." : "Consultar"}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      ) : !data ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
          <BarChart3 className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-lg font-medium">Selecciona un período y consulta</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 shadow-lg shadow-emerald-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-emerald-100 uppercase">Ingresos</span>
                <DollarSign className="w-5 h-5 text-emerald-200" />
              </div>
              <p className="text-2xl font-bold text-white">{$(resumen.ingresos)}</p>
              <p className="text-xs text-emerald-200 mt-1">{resumen.facturas} facturas</p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-5 shadow-lg shadow-red-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-red-100 uppercase">Gastos</span>
                <TrendingDown className="w-5 h-5 text-red-200" />
              </div>
              <p className="text-2xl font-bold text-white">{$(resumen.gastos)}</p>
              <p className="text-xs text-red-200 mt-1">{resumen.gastosCount} registros</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 shadow-lg shadow-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-blue-100 uppercase">Utilidad</span>
                <TrendingUp className="w-5 h-5 text-blue-200" />
              </div>
              <p className={`text-2xl font-bold text-white ${resumen.utilidad < 0 ? "text-red-200" : ""}`}>{$(Math.abs(resumen.utilidad))}</p>
              <p className="text-xs text-blue-200 mt-1">{resumen.utilidad >= 0 ? "Positiva" : "Negativa"}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 shadow-lg shadow-amber-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-amber-100 uppercase">Ocupación</span>
                <Car className="w-5 h-5 text-amber-200" />
              </div>
              <p className="text-2xl font-bold text-white">{pctOcupacion}%</p>
              <p className="text-xs text-amber-200 mt-1">{resumen.puestos?.ocupados || 0} / {resumen.puestos?.total || 0} puestos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-7 gap-5">
            <div className="lg:col-span-4">
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Evolución</p>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Ingresos vs Gastos</h3>
                  </div>
                  <Calendar className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                </div>
                {ingresosPorDia.some(i => i.ingresos > 0 || i.gastos > 0) ? (
                  <div>
                    <svg className="w-full h-44" viewBox="0 0 700 160" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="ingGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.02" />
                        </linearGradient>
                        <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>
                      {(() => {
                        const w = ingresosPorDia.length > 1 ? 700 / (ingresosPorDia.length - 1) : 700;
                        const h = 130;
                        const ptsIng = ingresosPorDia.map((i, idx) => ({ x: idx * w, y: h - (i.ingresos / maxDia) * h }));
                        const ptsGas = ingresosPorDia.map((i, idx) => ({ x: idx * w, y: h - (i.gastos / maxDia) * h }));
                        const lineIng = ptsIng.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
                        const areaIng = `${lineIng} L${ptsIng[ptsIng.length - 1].x},${h} L${ptsIng[0].x},${h} Z`;
                        const lineGas = ptsGas.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
                        const areaGas = `${lineGas} L${ptsGas[ptsGas.length - 1].x},${h} L${ptsGas[0].x},${h} Z`;
                        return (
                          <>
                            <path d={areaIng} fill="url(#ingGrad)" />
                            <path d={lineIng} fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                            {ptsIng.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#14b8a6" stroke="white" strokeWidth="2" />)}
                            <path d={areaGas} fill="url(#gasGrad)" />
                            <path d={lineGas} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4,3" />
                            {ptsGas.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#ef4444" stroke="white" strokeWidth="1.5" />)}
                          </>
                        );
                      })()}
                    </svg>
                    <div className="flex justify-between mt-1">
                      {ingresosPorDia.filter((_, i) => i % Math.max(1, Math.floor(ingresosPorDia.length / 7)) === 0 || i === ingresosPorDia.length - 1).map((i, idx) => (
                        <span key={idx} className="text-[10px] text-slate-400 dark:text-slate-500">{i.label}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-1 rounded bg-teal-500" /> Ingresos</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded bg-red-400" style={{ height: "2px", borderTop: "1.5px dashed #ef4444", background: "none" }} /> Gastos</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-400 dark:text-slate-500">
                    <TrendingUp className="w-7 h-7 mb-2 opacity-30" />
                    <p className="text-sm">Sin datos en el período</p>
                  </div>
                )}
              </Card>
            </div>

            <div className="lg:col-span-3">
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Horas</p>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Entradas por Hora</h3>
                  </div>
                  <BarChart3 className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                </div>
                {ocupacionHoras.some(h => h.count > 0) ? (
                  <div className="flex items-end gap-1 h-40">
                    {ocupacionHoras.filter((_, i) => i % 3 === 0).map((h, i) => {
                      const pct = (h.count / maxHora) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                          <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">{h.count}</span>
                          <div className="w-full rounded-t-sm bg-gradient-to-t from-teal-500 to-teal-400 transition-all duration-300"
                            style={{ height: `${Math.max(pct, h.count > 0 ? 4 : 0)}%` }} />
                          <span className="text-[9px] text-slate-400 dark:text-slate-500">{h.hora.slice(0, 2)}h</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-400 dark:text-slate-500">
                    <BarChart3 className="w-6 h-6 mb-1 opacity-30" />
                    <p className="text-xs">Sin entradas en el período</p>
                  </div>
                )}
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-7 gap-5">
            <div className="lg:col-span-4">
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Detalle</p>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Facturas</h3>
                  </div>
                  <Receipt className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                </div>
                {d.facturas?.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto scrollbar-thin divide-y divide-slate-100 dark:divide-slate-700/50">
                    {d.facturas.slice(0, 50).map(f => (
                      <div key={f.id} className="flex items-center justify-between py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                            #{f.numero} — {f.cliente || "Inv."} {f.placa ? `(${f.placa})` : ""}
                          </p>
                          <p className="text-xs text-slate-400">{f.metodoPago} · {formatDate(f.createdAt)}</p>
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white ml-3">{$(f.valor)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
                    <Receipt className="w-7 h-7 mb-2 opacity-30" />
                    <p className="text-sm">Sin facturas en el período</p>
                  </div>
                )}
              </Card>
            </div>

            <div className="lg:col-span-3">
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pagos</p>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Métodos de Pago</h3>
                  </div>
                  <CreditCard className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                </div>
                {metodosPago.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                      {(() => {
                        const total = metodosPago.reduce((s, m) => s + (m.total || 0), 0);
                        let offset = 0;
                        const r = 50;
                        const circ = 2 * Math.PI * r;
                        const colores = ["#14b8a6", "#3b82f6", "#8b5cf6", "#f59e0b"];
                        return metodosPago.map((m, i) => {
                          const pct = total > 0 ? (m.total || 0) / total : 0;
                          const len = pct * circ;
                          const seg = (
                            <circle key={m.metodo} cx="60" cy="60" r={r} fill="none"
                              stroke={colores[i % colores.length]} strokeWidth="16"
                              strokeDasharray={`${len} ${circ - len}`}
                              strokeDashoffset={-offset}
                              strokeLinecap="round"
                              className="transition-all duration-700"
                            />
                          );
                          offset += len;
                          return seg;
                        });
                      })()}
                      <circle cx="60" cy="60" r="38" fill="white" className="dark:fill-slate-800" />
                    </svg>
                    <div className="text-center -mt-2 mb-3">
                      <p className="text-lg font-bold text-slate-800 dark:text-white">{$(metodosPago.reduce((s, m) => s + (m.total || 0), 0))}</p>
                      <p className="text-[10px] text-slate-400">Total</p>
                    </div>
                    <div className="w-full space-y-2">
                      {metodosPago.map((m, i) => {
                        const Icon = metodoIconos[m.metodo] || Banknote;
                        const dot = ["bg-emerald-500", "bg-blue-500", "bg-violet-500", "bg-amber-500"][i % 4];
                        const total = metodosPago.reduce((s, mm) => s + (mm.total || 0), 0);
                        const pct = total > 0 ? Math.round(((m.total || 0) / total) * 100) : 0;
                        return (
                          <div key={m.metodo} className="flex items-center gap-2 py-1">
                            <span className={`w-2.5 h-2.5 rounded-full ${dot} shrink-0`} />
                            <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="text-xs text-slate-600 dark:text-slate-300 flex-1">{m.metodo}</span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-white">{$(m.total || 0)}</span>
                            <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                    <CreditCard className="w-6 h-6 mb-2 opacity-30" />
                    <p className="text-xs">Sin pagos en el período</p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

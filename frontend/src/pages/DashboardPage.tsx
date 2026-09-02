import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { formatCurrency, formatDate, formatTime } from "../utils/formatters";
import api from "../services/api";
import WhatsAppModal from "../components/WhatsAppModal";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import KpiCard from "../components/dashboard/KpiCard";
import OcupacionDashboard from "../components/dashboard/OcupacionDashboard";
import { WeeklyChart, HourlyChart, VehicleTypeChart } from "../components/dashboard/Charts";
import {
  DollarSign, Car, ParkingMeter, Wallet, TrendingUp, AlertTriangle,
  Users, Receipt, Clock, CreditCard, Landmark, Banknote,
  LogIn, UserPlus, LayoutGrid, Building2, ArrowRight,
  ChevronDown, MessageCircle
} from "lucide-react";

const $ = (v: number) => formatCurrency(v);
const n = (v: number) => (v ?? 0).toLocaleString();
const hoy = () => new Date();
const days7 = (ref: Date) => {
  const r: { label: string; date: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ref);
    d.setDate(d.getDate() - i);
    r.push({ label: d.toLocaleDateString("es-CO", { weekday: "short" }), date: d.toISOString().slice(0, 10) });
  }
  return r;
};

const filtros = [
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Esta Semana" },
  { key: "mes", label: "Este Mes" },
];

const quickActions = [
  { label: "Nuevo Ingreso", icon: LogIn, route: "/ingresos", color: "bg-emerald-600 hover:bg-emerald-700" },
  { label: "Nuevo Cliente", icon: UserPlus, route: "/clientes", color: "bg-blue-600 hover:bg-blue-700" },
  { label: "Abrir Caja", icon: Wallet, route: "/caja", color: "bg-teal-600 hover:bg-teal-700" },
  { label: "Nuevo Puesto", icon: LayoutGrid, route: "/puestos", color: "bg-violet-600 hover:bg-violet-700" },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { config } = useConfig();
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("hoy");
  const [sucursales, setSucursales] = useState<Array<{ id: number; nombre: string }>>([]);
  const [sucursalSel, setSucursalSel] = useState("");
  const [sucOpen, setSucOpen] = useState(false);
  const [puestos, setPuestos] = useState<Array<Record<string, unknown>>>([]);
  const [puestosLoading, setPuestosLoading] = useState(true);

  useEffect(() => {
    api.get("/sucursales")
      .then((res) => {
        const list = res.data?.sucursales || res.data || [];
        setSucursales(list);
        if (list.length > 0) setSucursalSel(list[0].id?.toString() || "");
      })
      .catch(() => { /* ignore */ });
    api.get("/puestos", { params: { all: true } })
      .then((res) => { setPuestos(res.data?.puestos || res.data?.data || []); })
      .catch(() => { /* ignore */ })
      .finally(() => { setPuestosLoading(false); });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { filtro };
    if (sucursalSel) params.sucursalId = sucursalSel;
    api.get("/dashboard", { params })
      .then((res) => { setData(res.data); })
      .catch(() => { /* ignore */ })
      .finally(() => { setLoading(false); });
  }, [filtro, sucursalSel]);

  if (loading) {
    return (
      <div className="p-6 space-y-5">
        <div className="h-7 w-44 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          <div className="lg:col-span-4 h-60 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          <div className="lg:col-span-3 h-60 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const d = data || {};
  const now = hoy();
  const h = now.getHours();
  const saludo = h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches";
  const fechaStr = formatDate(now.toISOString());
  const hora12 = formatTime(now.toISOString());

  const ingresosDia = (d.ingresosDia as number) || 0;
  const gastosDia = (d.gastosDia as number) || 0;
  const utilidad = (d.utilidadDia as number) || 0;
  const puestosOcupados = (d.puestosOcupados as number) || 0;
  const totalPuestos = (d.totalPuestos as number) || 0;
  const puestosLibres = (d.puestosLibres as number) || 0;
  const pctOcupacion = totalPuestos > 0 ? Math.round((puestosOcupados / totalPuestos) * 100) : 0;
  const vehiculosActivos = (d.ingresosActivos as number) || 0;
  const ingresosHoy = (d.ingresosHoy as number) || 0;
  const cajaAbierta = (d.cajaAbierta as boolean) || false;
  const cajaMontoInicial = (d.cajaMontoInicial as number) || 0;
  const mensualidadesVencidas = (d.mensualidadesVencidas as number) || 0;
  const mensualidadesProximas = (d.mensualidadesProximas as number) || 0;
  const totalClientes = (d.totalClientes as number) || 0;
  const ingresosSemana = (d.ingresosSemana as number) || 0;
  const ingresosMes = (d.ingresosMes as number) || 0;
  const clientesMorosos = (d.clientesMorosos as number) || 0;
  const ausenciasActivas = (d.ausenciasActivas as number) || 0;
  const reservasHoy = (d.reservasHoy as number) || 0;
  const reservasPendientes = (d.reservasPendientes as number) || 0;

  const ingresos7Dias = Array.isArray(d.ingresos7Dias) ? d.ingresos7Dias : [];
  const gastos7Dias = Array.isArray(d.gastos7Dias) ? d.gastos7Dias : [];
  const ingresosPorHora = Array.isArray(d.ingresosPorHora) ? d.ingresosPorHora : [];
  const ingresosMensuales = Array.isArray(d.ingresosMensuales) ? d.ingresosMensuales : [];
  const movimientos = Array.isArray(d.movimientos) ? (d.movimientos as Array<Record<string, unknown>>).slice(0, 8) : [];

  let metodosPagoArr: Array<{ metodo: string; total: number; count: number }> = [];
  if (d.metodosPago && typeof d.metodosPago === "object") {
    metodosPagoArr = Object.entries(d.metodosPago as Record<string, { total?: number; count?: number }>).map(([metodo, val]) => ({
      metodo, total: val.total || 0, cantidad: val.count || 0,
    }));
  } else if (Array.isArray(d.metodosPago)) {
    metodosPagoArr = d.metodosPago as Array<{ metodo: string; total: number; count: number }>;
  }

  const vehiculosTipo = d.vehiculosPorTipo && typeof d.vehiculosPorTipo === "object"
    ? Object.entries(d.vehiculosPorTipo as Record<string, number>).filter(([, v]) => v > 0).map(([k, v]) => ({ tipo: k, count: v }))
    : [];
  const maxTipo = Math.max(...vehiculosTipo.map((t) => t.count), 1);

  const maxHora = Math.max(...(ingresosPorHora as Array<{ count: number }>).map((h) => h.count), 1);

  const dias = days7(now);
  const bars = dias.map((day) => {
    const found = (ingresos7Dias as Array<Record<string, unknown>>).find((i) => i.fecha === day.date || i.dia === day.date);
    const gasto = (gastos7Dias as Array<Record<string, unknown>>).find((g) => g.fecha === day.date || g.dia === day.date);
    return { label: day.label, total: (found?.total as number) || 0, gasto: (gasto?.total as number) || 0 };
  });
  const maxBar = Math.max(...bars.map((b) => Math.max(b.total, b.gasto)), 1);

  const metodoIconos: Record<string, React.ComponentType<{ className?: string }>> = { Efectivo: Banknote, Tarjeta: CreditCard, Transferencia: Landmark };

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-widest">{saludo}, {user?.nombre || "Admin"}</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5 capitalize">{config?.nombreParqueadero || "Admin"}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 capitalize">{fechaStr}</p>
        </div>
        <div className="flex items-center gap-3">
          {sucursales.length > 0 && (
            <div className="relative">
              <button onClick={() => setSucOpen(!sucOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer min-w-[140px]">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="flex-1 text-left truncate">{sucursales.find(s => s.id?.toString() === sucursalSel)?.nombre || "Sucursal"}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${sucOpen ? "rotate-180" : ""}`} />
              </button>
              {sucOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSucOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1">
                    {sucursales.map((s) => (
                      <button key={s.id} onClick={() => { setSucursalSel(s.id?.toString() || ""); setSucOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${sucursalSel === s.id?.toString() ? "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                        {s.nombre}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            {filtros.map((f) => (
              <button key={f.key} onClick={() => setFiltro(f.key)}
                className={`px-3 py-2 text-xs font-medium transition-all cursor-pointer ${
                  filtro === f.key ? "bg-teal-500 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}>{f.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={() => setWhatsappOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </button>
            <div className="flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 rounded-xl shadow-lg shadow-teal-600/20">
              <Clock className="w-4 h-4 text-teal-100" />
              <span className="text-sm font-bold text-white tracking-wide">{hora12}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Ingresos" icon={DollarSign} bg="emerald" route="/ingresos" value={$(ingresosDia)} subtitle={utilidad >= 0 ? `Utilidad: ${$(utilidad)}` : `Perdida: ${$(Math.abs(utilidad))}`} />
        <KpiCard label="Ocupacion" icon={ParkingMeter} bg="blue" route="/puestos" value={`${pctOcupacion}%`} subtitle={`${puestosOcupados} ocupados · ${puestosLibres} libres`} />
        <KpiCard label="Vehiculos" icon={Car} bg="amber" route="/vehiculos" value={n(vehiculosActivos)} subtitle={`${n(ingresosHoy)} entradas hoy`} />
        <KpiCard label="Caja" icon={Wallet} bg={cajaAbierta ? "teal" : "slate"} route="/caja" value={cajaAbierta ? "Abierta" : "Cerrada"} subtitle={cajaAbierta ? `Inicial: ${$(cajaMontoInicial)}` : "Presiona para abrir"} />
        <KpiCard label="Alertas" icon={AlertTriangle} bg={mensualidadesVencidas > 0 || clientesMorosos > 0 ? "red" : "slate"} route="/mensualidades" value={mensualidadesVencidas + clientesMorosos + ausenciasActivas > 0 ? n(mensualidadesVencidas + clientesMorosos + ausenciasActivas) : "0"} subtitle={ausenciasActivas > 0 ? `${ausenciasActivas} ausencias` : mensualidadesVencidas > 0 ? `${n(mensualidadesVencidas)} vencidas` : mensualidadesProximas > 0 ? `${mensualidadesProximas} próximas` : "Sin novedades"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-5">
        <div className="lg:col-span-4 space-y-5">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Acceso Rapido</p>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Acciones</h3>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {quickActions.map((a) => {
                const Icon = a.icon;
                return (
                  <button key={a.route} onClick={() => navigate(a.route)}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl text-white text-xs font-medium transition-all active:scale-[0.97] shadow-sm ${a.color}`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    {a.label}
                  </button>
                );
              })}
            </div>
          </Card>
          <WeeklyChart bars={bars} maxBar={maxBar} ingresosSemana={ingresosSemana} ingresosMes={ingresosMes} />
        </div>

        <div className="lg:col-span-3">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Totales</p>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Resumen</h3>
              </div>
              <Building2 className="w-4 h-4 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                <p className="text-lg font-bold text-white">{$(ingresosSemana)}</p>
                <p className="text-[10px] text-emerald-100">Semana</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                <p className="text-lg font-bold text-white">{n(totalClientes)}</p>
                <p className="text-[10px] text-blue-100">Clientes</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/20">
                <p className="text-lg font-bold text-white">{$(gastosDia)}</p>
                <p className="text-[10px] text-red-100">Gastos hoy</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-500/20">
                <p className="text-lg font-bold text-white">{reservasHoy}</p>
                <p className="text-[10px] text-violet-100">Reservas</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-5">
        <div className="lg:col-span-4">
          <HourlyChart ingresosPorHora={ingresosPorHora} maxHora={maxHora} />
        </div>
        <div className="lg:col-span-3">
          <VehicleTypeChart vehiculosTipo={vehiculosTipo} maxTipo={maxTipo} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-5">
        <div className="lg:col-span-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Actividad</p>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Movimientos Recientes</h3>
              </div>
              <Clock className="w-4 h-4 text-slate-300 dark:text-slate-600" />
            </div>
            {movimientos.length > 0 ? (
              <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
                {movimientos.map((m) => (
                  <div key={m.id as string} className="flex items-center gap-3 py-2.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.tipo === "entrada" ? "bg-emerald-500" : "bg-red-400"} shadow-sm`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                        {(m.placa as string) || ((m.vehiculo as Record<string, unknown>)?.placa as string) || "—"}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {(m.cliente as Record<string, unknown>)?.nombres as string || (m.clienteNombre as string) || ""}
                        {m.createdAt ? ` ${new Date(m.createdAt as string).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hourCycle: "h12" })}` : ""}
                      </p>
                    </div>
                    <Badge variant={m.tipo === "entrada" ? "success" : "danger"} dot>
                      {m.tipo === "entrada" ? "Entrada" : "Salida"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
                <Car className="w-7 h-7 mb-2 opacity-30" />
                <p className="text-sm font-medium">Sin movimientos recientes</p>
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pagos</p>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Metodos de Pago</h3>
              </div>
              <Receipt className="w-4 h-4 text-slate-300 dark:text-slate-600" />
            </div>
            {metodosPagoArr.length > 0 ? (
              <div className="flex flex-col items-center">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                  {(() => {
                    const total = metodosPagoArr.reduce((s, m) => s + (m.total || 0), 0);
                    let offset = 0;
                    const r = 50;
                    const circ = 2 * Math.PI * r;
                    const colores = ["#14b8a6", "#3b82f6", "#8b5cf6"];
                    return metodosPagoArr.map((m, i) => {
                      const pct = (m.total || 0) / total;
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
                <div className="text-center -mt-4 mb-3">
                  <p className="text-lg font-bold text-slate-800 dark:text-white">{$(metodosPagoArr.reduce((s, m) => s + (m.total || 0), 0))}</p>
                  <p className="text-[10px] text-slate-400">Total pagos</p>
                </div>
                <div className="w-full space-y-2">
                  {metodosPagoArr.map((m, i) => {
                    const Icon = metodoIconos[m.metodo] || Banknote;
                    const colores = ["text-emerald-500", "text-blue-500", "text-violet-500"];
                    const dots = ["bg-emerald-500", "bg-blue-500", "bg-violet-500"];
                    const total = metodosPagoArr.reduce((s, mm) => s + (mm.total || 0), 0);
                    const pct = total > 0 ? Math.round(((m.total || 0) / total) * 100) : 0;
                    return (
                      <div key={m.metodo} className="flex items-center gap-2 py-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${dots[i % dots.length]} shrink-0`} />
                        <Icon className={`w-3.5 h-3.5 ${colores[i % colores.length]} shrink-0`} />
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
                <p className="text-xs font-medium">Sin pagos registrados</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vencimientos</p>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Próximos 7 días</h3>
            </div>
            <Clock className="w-4 h-4 text-slate-300 dark:text-slate-600" />
          </div>
          {mensualidadesProximas > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{n(mensualidadesProximas)} suscripciones próximas a vencer</p>
                  <p className="text-xs text-amber-600/70 dark:text-amber-400/70">Revisa y renueva antes del vencimiento</p>
                </div>
              </div>
              <button onClick={() => navigate("/mensualidades")}
                className="w-full text-center text-xs font-medium text-teal-600 dark:text-teal-400 py-2 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors cursor-pointer">
                Ver suscripciones →
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-24 text-slate-400 dark:text-slate-500">
              <Clock className="w-6 h-6 mb-1 opacity-30" />
              <p className="text-xs">Sin vencimientos próximos</p>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ausencias</p>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Activas hoy</h3>
            </div>
            <Users className="w-4 h-4 text-slate-300 dark:text-slate-600" />
          </div>
          {ausenciasActivas > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{n(ausenciasActivas)} ausencias activas</p>
                  <p className="text-xs text-amber-600/70 dark:text-amber-400/70">Clientes ausentes con puesto reservado</p>
                </div>
              </div>
              <button onClick={() => navigate("/ausencias")}
                className="w-full text-center text-xs font-medium text-teal-600 dark:text-teal-400 py-2 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors cursor-pointer">
                Gestionar ausencias →
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-24 text-slate-400 dark:text-slate-500">
              <Users className="w-6 h-6 mb-1 opacity-30" />
              <p className="text-xs">Sin ausencias activas</p>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Flota</p>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Vehículos más frecuentes</h3>
            </div>
            <Car className="w-4 h-4 text-slate-300 dark:text-slate-600" />
          </div>
          {(d.topVehiculos as Array<Record<string, unknown>>)?.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
              {(d.topVehiculos as Array<Record<string, unknown>>).map((v, i) => (
                <div key={(v.placa as string) || i}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-slate-400"}`}>
                    {i < 3 ? ["🥇","🥈","🥉"][i] : `#${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{(v.placa as string) || "—"}</p>
                    <p className="text-[11px] text-slate-400 truncate">{(v.cliente as string) || (v.tipo as string) || ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-teal-600 dark:text-teal-400">{v.total as number}</p>
                    <p className="text-[10px] text-slate-400">visitas</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-24 text-slate-400 dark:text-slate-500">
              <Car className="w-6 h-6 mb-1 opacity-30" />
              <p className="text-xs">Sin datos de frecuencia</p>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Anual</p>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Ingresos Mensuales</h3>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{$(ingresosMes)}</p>
            <p className="text-[11px] text-slate-400">{ingresosMensuales.length > 0 ? `${(ingresosMensuales[now.getMonth()] as Record<string, unknown>)?.mes || ""} · ${$((ingresosMensuales[now.getMonth()] as Record<string, unknown>)?.total as number || 0)}` : ""}</p>
          </div>
        </div>
        {(ingresosMensuales as Array<Record<string, unknown>>).some((m) => (m.total as number) > 0) ? (
          <div className="flex items-end gap-1.5 h-32">
            {(ingresosMensuales as Array<Record<string, unknown>>).map((m) => {
              const maxAnual = Math.max(...(ingresosMensuales as Array<Record<string, unknown>>).map((x) => (x.total as number) || 0), 1);
              const pct = ((m.total as number) || 0) / maxAnual * 100;
              const esActual = m.mes === (ingresosMensuales[now.getMonth()] as Record<string, unknown>)?.mes;
              return (
                <div key={m.mes as string} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                  <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">{(m.total as number) > 0 ? $((m.total as number)) : ""}</span>
                  <div className={`w-full rounded-t-sm transition-all duration-500 ${esActual ? "bg-gradient-to-t from-teal-500 to-teal-400 shadow-sm" : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"}`}
                    style={{ height: `${Math.max(pct, (m.total as number) > 0 ? 4 : 0)}%` }} />
                  <span className={`text-[10px] ${esActual ? "text-teal-600 dark:text-teal-400 font-semibold" : "text-slate-400 dark:text-slate-500"}`}>{m.mes as string}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-24 text-slate-400 dark:text-slate-500">
            <TrendingUp className="w-6 h-6 mb-1 opacity-30" />
            <p className="text-xs">Sin datos anuales</p>
          </div>
        )}
      </Card>

      <OcupacionDashboard puestos={puestos} loading={puestosLoading} />

      <WhatsAppModal open={whatsappOpen} onClose={() => setWhatsappOpen(false)} config={config} />
    </div>
  );
}

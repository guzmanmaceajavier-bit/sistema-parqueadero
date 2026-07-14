import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { formatCurrency, formatDate, formatTime } from "../utils/formatters";
import WhatsAppModal from "../components/WhatsAppModal";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import {
  DollarSign, Car, ParkingMeter, Wallet, TrendingUp, AlertTriangle,
  Users, Receipt, Clock, CreditCard, Landmark, Banknote,
  LogIn, UserPlus, LayoutGrid, Building2, ArrowRight,
  ChevronDown, BarChart3, Bike, Truck, MessageCircle
} from "lucide-react";

const $ = (v) => formatCurrency(v);
const n = (v) => (v ?? 0).toLocaleString();
const hoy = () => new Date();
const days7 = (ref) => {
  const r = [];
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

function KpiCardFull({ label, value, subtitle, icon: Icon, bg, route, badge }) {
  const navigate = useNavigate();
  const bgMap = {
    emerald: "bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-600",
    blue: "bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600",
    amber: "bg-amber-600 dark:bg-amber-700 hover:bg-amber-700 dark:hover:bg-amber-600",
    teal: "bg-teal-600 dark:bg-teal-700 hover:bg-teal-700 dark:hover:bg-teal-600",
    red: "bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600",
    slate: "bg-slate-500 dark:bg-slate-600 hover:bg-slate-600 dark:hover:bg-slate-500",
  };
  const c = bgMap[bg] || bgMap.slate;
  return (
    <div onClick={() => navigate(route)}
      className={`relative rounded-xl shadow-sm overflow-hidden transition-all duration-200 cursor-pointer active:scale-[0.98] ${c}`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">{label}</span>
          <div className="p-2 rounded-lg bg-white/15">
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-white/70">{subtitle}</span>
        </div>
      </div>
    </div>
  );
}

const ESTADO_CFG = {
  LIBRE: { bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  OCUPADO: { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-300 dark:border-red-700", text: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
  RESERVADO: { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-300 dark:border-amber-700", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  MANTENIMIENTO: { bg: "bg-slate-100 dark:bg-slate-800", border: "border-slate-300 dark:border-slate-600", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" },
};

function OcupacionDashboard({ puestos, loading }) {
  const [zonaSel, setZonaSel] = useState("");

  const zonas = [...new Set(puestos.map((p) => p.zona).filter(Boolean))].sort();

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
              !zonaSel
                ? "bg-teal-500 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}>
            Todas
          </button>
          {zonas.map((z) => (
            <button key={z} onClick={() => setZonaSel(z)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                zonaSel === z
                  ? "bg-teal-500 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}>
              {z}
            </button>
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("hoy");
  const [sucursales, setSucursales] = useState([]);
  const [sucursalSel, setSucursalSel] = useState("");
  const [sucOpen, setSucOpen] = useState(false);
  const [puestos, setPuestos] = useState([]);
  const [puestosLoading, setPuestosLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sucursales", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((list) => { setSucursales(list); if (list.length > 0) setSucursalSel(list[0].id?.toString() || ""); })
      .catch(() => {});
    (async () => {
      try {
        const r = await fetch("/api/puestos?all=true", { credentials: "include" });
        if (r.ok) {
          const j = await r.json();
          setPuestos(j.puestos || j.data || []);
        }
      } catch {} finally { setPuestosLoading(false); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ filtro });
        if (sucursalSel) params.set("sucursalId", sucursalSel);
        const res = await fetch(`/api/dashboard?${params}`, { credentials: "include" });
        if (res.ok) setData(await res.json());
      } catch {} finally { setLoading(false); }
    })();
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
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          <div className="lg:col-span-4 h-64 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          <div className="lg:col-span-3 h-64 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
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

  const ingresosDia = d.ingresosDia || 0;
  const gastosDia = d.gastosDia || 0;
  const utilidad = d.utilidadDia || 0;
  const puestosOcupados = d.puestosOcupados || 0;
  const totalPuestos = d.totalPuestos || 0;
  const puestosLibres = d.puestosLibres || 0;
  const puestosMantenimiento = d.puestosMantenimiento || 0;
  const puestosReservados = d.puestosReservados || 0;
  const pctOcupacion = totalPuestos > 0 ? Math.round((puestosOcupados / totalPuestos) * 100) : 0;
  const vehiculosActivos = d.ingresosActivos || 0;
  const ingresosHoy = d.ingresosHoy || 0;
  const clientesActivos = d.clientesActivos || 0;
  const cajaAbierta = d.cajaAbierta || false;
  const cajaMontoInicial = d.cajaMontoInicial || 0;
  const mensualidadesVencidas = d.mensualidadesVencidas || 0;
  const mensualidadesProximas = d.mensualidadesProximas || 0;
  const totalClientes = d.totalClientes || 0;
  const totalVehiculos = d.totalVehiculos || 0;
  const ingresosSemana = d.ingresosSemana || 0;
  const ingresosMes = d.ingresosMes || 0;
  const clientesMorosos = d.clientesMorosos || 0;
  const ausenciasActivas = d.ausenciasActivas || 0;
  const topVehiculos = Array.isArray(d.topVehiculos) ? d.topVehiculos : [];
  const reservasHoy = d.reservasHoy || 0;
  const reservasPendientes = d.reservasPendientes || 0;
  const ocupacion = d.ocupacion || 0;

  const ingresos7Dias = Array.isArray(d.ingresos7Dias) ? d.ingresos7Dias : [];
  const gastos7Dias = Array.isArray(d.gastos7Dias) ? d.gastos7Dias : [];
  const ingresosPorHora = Array.isArray(d.ingresosPorHora) ? d.ingresosPorHora : [];
  const ingresosMensuales = Array.isArray(d.ingresosMensuales) ? d.ingresosMensuales : [];
  const movimientos = Array.isArray(d.movimientos) ? d.movimientos.slice(0, 8) : [];

  let metodosPagoArr = [];
  if (d.metodosPago && typeof d.metodosPago === "object") {
    metodosPagoArr = Object.entries(d.metodosPago).map(([metodo, val]) => ({
      metodo, total: val.total || 0, cantidad: val.count || 0,
    }));
  } else if (Array.isArray(d.metodosPago)) {
    metodosPagoArr = d.metodosPago;
  }

  const vehiculosTipo = d.vehiculosPorTipo && typeof d.vehiculosPorTipo === "object"
    ? Object.entries(d.vehiculosPorTipo).filter(([, v]) => v > 0).map(([k, v]) => ({ tipo: k, count: v }))
    : [];
  const maxTipo = Math.max(...vehiculosTipo.map((t) => t.count), 1);
  const tipoIconos = { carro: Car, moto: Bike, camion: Truck, camioneta: Truck };
  const tipoColores = { carro: "text-blue-500", moto: "text-emerald-500", camion: "text-amber-500", camioneta: "text-violet-500" };
  const tipoBars = { carro: "bg-blue-500", moto: "bg-emerald-500", camion: "bg-amber-500", camioneta: "bg-violet-500" };

  const maxHora = Math.max(...ingresosPorHora.map((h) => h.count), 1);

  const dias = days7(now);
  const bars = dias.map((day) => {
    const found = ingresos7Dias.find((i) => i.fecha === day.date || i.dia === day.date);
    const gasto = gastos7Dias.find((g) => g.fecha === day.date || g.dia === day.date);
    return { ...day, total: found ? found.total : 0, gasto: gasto ? gasto.total : 0 };
  });
  const maxBar = Math.max(...bars.map((b) => Math.max(b.total, b.gasto)), 1);
  const maxMetodo = metodosPagoArr.length > 0 ? Math.max(...metodosPagoArr.map((m) => m.total || 0), 1) : 1;

  const metodoIconos = { Efectivo: Banknote, Tarjeta: CreditCard, Transferencia: Landmark };
  const metodoColores = { Efectivo: "bg-emerald-500", Tarjeta: "bg-blue-500", Transferencia: "bg-violet-500" };
  const metodoBg = {
    Efectivo: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600",
    Tarjeta: "bg-blue-50 dark:bg-blue-900/20 text-blue-600",
    Transferencia: "bg-violet-50 dark:bg-violet-900/20 text-violet-600",
  };

  const alertas = [];
  if (mensualidadesVencidas > 0) alertas.push({ icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20", label: `${n(mensualidadesVencidas)} mensualidades vencidas`, action: "Ir a Suscripciones", route: "/mensualidades" });
  if (clientesMorosos > 0) alertas.push({ icon: Users, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", label: `${n(clientesMorosos)} clientes morosos`, action: "Ver clientes", route: "/clientes" });
  if (pctOcupacion > 85) alertas.push({ icon: ParkingMeter, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20", label: `Parqueadero al ${pctOcupacion}% de capacidad`, action: "Ver puestos", route: "/puestos" });
  if (reservasPendientes > 0) alertas.push({ icon: Clock, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", label: `${n(reservasPendientes)} reservas pendientes`, action: "Ver reservas", route: "/reservas" });
  if (cajaAbierta && d.cajaDesde) {
    const horas = Math.floor((new Date() - new Date(d.cajaDesde)) / 3600000);
    if (horas > 10) alertas.push({ icon: Wallet, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", label: `Caja abierta hace ${horas}h (${d.cajaDesde ? new Date(d.cajaDesde).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hourCycle: "h12" }) : ""})`, action: "Cerrar caja", route: "/caja" });
  }

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
                  filtro === f.key
                    ? "bg-teal-500 text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}>
                {f.label}
              </button>
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
        <KpiCardFull label="Ingresos" icon={DollarSign} bg="emerald" route="/ingresos"
          value={$(ingresosDia)}
          subtitle={utilidad >= 0 ? `Utilidad: ${$(utilidad)}` : `Perdida: ${$(Math.abs(utilidad))}`}
        />
        <KpiCardFull label="Ocupacion" icon={ParkingMeter} bg="blue" route="/puestos"
          value={`${pctOcupacion}%`}
          subtitle={`${puestosOcupados} ocupados · ${puestosLibres} libres`}
        />
        <KpiCardFull label="Vehiculos" icon={Car} bg="amber" route="/vehiculos"
          value={n(vehiculosActivos)}
          subtitle={`${n(ingresosHoy)} entradas hoy`}
        />
        <KpiCardFull label="Caja" icon={Wallet} bg={cajaAbierta ? "teal" : "slate"} route="/caja"
          value={cajaAbierta ? "Abierta" : "Cerrada"}
          subtitle={cajaAbierta ? `Inicial: ${$(cajaMontoInicial)}` : "Presiona para abrir"}
        />
        <KpiCardFull label="Alertas" icon={AlertTriangle} bg={mensualidadesVencidas > 0 || clientesMorosos > 0 ? "red" : "slate"} route="/mensualidades"
          value={mensualidadesVencidas + clientesMorosos + ausenciasActivas > 0 ? n(mensualidadesVencidas + clientesMorosos + ausenciasActivas) : "0"}
          subtitle={ausenciasActivas > 0 ? `${ausenciasActivas} ausencias` : mensualidadesVencidas > 0 ? `${n(mensualidadesVencidas)} vencidas` : mensualidadesProximas > 0 ? `${mensualidadesProximas} próximas` : "Sin novedades"}
        />
      </div>

      {alertas.length > 0 && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {alertas.slice(0, 6).map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} onClick={() => navigate(a.route)}
                  className={`flex items-center justify-between p-3 rounded-xl ${a.bg} cursor-pointer hover:brightness-95 transition-all`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-5 h-5 shrink-0 ${a.color}`} />
                    <span className={`text-sm font-medium truncate ${a.color}`}>{a.label}</span>
                  </div>
                  <ArrowRight className={`w-4 h-4 shrink-0 ${a.color} opacity-50`} />
                </div>
              );
            })}
          </div>
        </div>
      )}

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

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Analytics</p>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Ingresos Semanales</h3>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{$(ingresosSemana)}</p>
                <p className="text-[11px] text-slate-400">Semana · Mes: {$(ingresosMes)}</p>
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
        </div>

        <div className="lg:col-span-3 space-y-5">
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
                    const w = totalH > 1 ? 700 / (totalH - 1) : 700;
                    const h = 85;
                    const pts = data.map((d) => ({ x: d.x || 0, y: h - (d.count / maxHora) * h }));
                    // Distribute points evenly
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
        </div>

        <div className="lg:col-span-3">
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
                  const colors = {
                    carro: { bg: "bg-blue-50 dark:bg-blue-900/20", bar: "bg-gradient-to-r from-blue-500 to-blue-400", text: "text-blue-700 dark:text-blue-300", icon: "text-blue-500 dark:text-blue-400" },
                    moto: { bg: "bg-emerald-50 dark:bg-emerald-900/20", bar: "bg-gradient-to-r from-emerald-500 to-emerald-400", text: "text-emerald-700 dark:text-emerald-300", icon: "text-emerald-500 dark:text-emerald-400" },
                    camion: { bg: "bg-amber-50 dark:bg-amber-900/20", bar: "bg-gradient-to-r from-amber-500 to-amber-400", text: "text-amber-700 dark:text-amber-300", icon: "text-amber-500 dark:text-amber-400" },
                    camioneta: { bg: "bg-violet-50 dark:bg-violet-900/20", bar: "bg-gradient-to-r from-violet-500 to-violet-400", text: "text-violet-700 dark:text-violet-300", icon: "text-violet-500 dark:text-violet-400" },
                  };
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
                        <span className="text-lg font-bold text-slate-800 dark:text-white">{n(t.count)}</span>
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
                  <div key={m.id} className="flex items-center gap-3 py-2.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.tipo === "entrada" ? "bg-emerald-500" : "bg-red-400"} shadow-sm`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                        {m.placa || m.vehiculo?.placa || "—"}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {m.cliente?.nombres || m.clienteNombre || ""}
                        {m.createdAt ? ` ${new Date(m.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hourCycle: "h12" })}` : ""}
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
                <p className="text-xs mt-1">Las entradas y salidas apareceran aqui</p>
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
          {topVehiculos.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
              {topVehiculos.map((v, i) => (
                <div key={v.placa || i}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-slate-400"}`}>
                    {i < 3 ? ["🥇","🥈","🥉"][i] : `#${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{v.placa || "—"}</p>
                    <p className="text-[11px] text-slate-400 truncate">{v.cliente || v.tipo || ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-teal-600 dark:text-teal-400">{v.total}</p>
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

      <div className="grid grid-cols-1 gap-5">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Anual</p>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Ingresos Mensuales</h3>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{$(ingresosMes)}</p>
              <p className="text-[11px] text-slate-400">{ingresosMensuales.length > 0 ? `${ingresosMensuales[now.getMonth()]?.mes || ""} · ${$(ingresosMensuales[now.getMonth()]?.total || 0)}` : ""}</p>
            </div>
          </div>
          {ingresosMensuales.some((m) => m.total > 0) ? (
            <div className="flex items-end gap-1.5 h-32">
              {ingresosMensuales.map((m) => {
                const maxAnual = Math.max(...ingresosMensuales.map((x) => x.total), 1);
                const pct = (m.total / maxAnual) * 100;
                const esActual = m.mes === ingresosMensuales[now.getMonth()]?.mes;
                return (
                  <div key={m.mes} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                    <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">{m.total > 0 ? $(m.total) : ""}</span>
                    <div className={`w-full rounded-t-sm transition-all duration-500 ${esActual ? "bg-gradient-to-t from-teal-500 to-teal-400 shadow-sm" : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"}`}
                      style={{ height: `${Math.max(pct, m.total > 0 ? 4 : 0)}%` }} />
                    <span className={`text-[10px] ${esActual ? "text-teal-600 dark:text-teal-400 font-semibold" : "text-slate-400 dark:text-slate-500"}`}>{m.mes}</span>
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
      </div>

      <OcupacionDashboard puestos={puestos} loading={puestosLoading} />

      <WhatsAppModal open={whatsappOpen} onClose={() => setWhatsappOpen(false)} config={config} />
    </div>
  );
}

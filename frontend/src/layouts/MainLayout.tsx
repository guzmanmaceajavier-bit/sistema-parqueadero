import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Menu, Car, Bike, Truck, ParkingMeter, Search } from "lucide-react";
import Sidebar from "../components/Sidebar";
import CampanaNotificaciones from "../components/CampanaNotificaciones";
import CajaStatusWidget from "../components/CajaStatusWidget";
import { useConfig } from "../context/ConfigContext";
import { useAuth } from "../context/AuthContext";
import { useCaja } from "../context/CajaContext";
import { useCajaRecordatorio } from "../hooks/useCajaRecordatorio";
import api from "../services/api";

const tipoIconos = { carro: Car, moto: Bike, camioneta: Truck, bicicleta: Bike, otro: Car };
const tipoColores = {
  carro: "text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  moto: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
  camioneta: "text-violet-500 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800",
  bicicleta: "text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
  otro: "text-slate-500 bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700",
};

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { cajaAbierta } = useCaja();
  const { CajaRecordatorioBanner } = useCajaRecordatorio(cajaAbierta);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [sidebarColapsado, setSidebarColapsado] = useState(() => {
    return localStorage.getItem("sidebar_colapsado") === "true";
  });
  const { config } = useConfig();
  const [vehiculosPorTipo, setVehiculosPorTipo] = useState({});
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      if (!isAuthenticated) return;
      try {
        const res = await api.get("/dashboard", { params: { filtro: "hoy" } });
        setVehiculosPorTipo(res.data?.vehiculosPorTipo || {});
      } catch { /* ignore */ }
    };
    fetchStats();
    const t = setInterval(fetchStats, 30000);
    return () => clearInterval(t);
  }, [isAuthenticated]);

  useEffect(() => {
    localStorage.setItem("sidebar_colapsado", sidebarColapsado);
  }, [sidebarColapsado]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate, location.pathname]);

  const tipos = Object.entries(vehiculosPorTipo).filter(([, c]) => c > 0);

  return (
    <div className="flex h-screen bg-white dark:bg-slate-900 overflow-hidden">
      <Sidebar
        abierto={sidebarAbierto}
        onToggle={() => setSidebarAbierto(!sidebarAbierto)}
        colapsado={sidebarColapsado}
        onColapsar={() => setSidebarColapsado(!sidebarColapsado)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300">
        <header className="bg-white dark:bg-slate-800/95 border-b border-slate-200 dark:border-slate-700/50 h-16 lg:h-14 flex items-center justify-between gap-2 px-3 lg:px-5 shrink-0">
          <div className="flex items-center gap-2 lg:gap-3 min-w-0">
            <button onClick={() => setSidebarAbierto(true)}
              className="p-1.5 -ml-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg lg:hidden cursor-pointer transition-colors shrink-0">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              {config?.logo ? (
                <img src={config.logo} alt="" className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0" />
              ) : (
                <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shrink-0 shadow-sm ring-1 ring-white/20">
                  <ParkingMeter className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-white" />
                </div>
              )}
              <div className="min-w-0 hidden sm:block">
                <h1 className="text-sm font-bold text-slate-800 dark:text-white truncate leading-tight">{config?.nombreParqueadero || "Parqueadero"}</h1>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-tight">{config?.direccion ? config.direccion : "admin"}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1">
              {tipos.length > 0 ? tipos.map(([tipo, count]) => {
                const Icon = tipoIconos[tipo] || Car;
                const c = tipoColores[tipo] || "text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700";
                return (
                  <div key={tipo} className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${c}`}>
                    <Icon className="w-3 h-3" />
                    <span className="text-[11px] font-bold">{count}</span>
                  </div>
                );
              }) : (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg border text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <Car className="w-3 h-3" />
                  <span className="text-[11px] font-bold">0</span>
                </div>
              )}
            </div>
            <div className="relative hidden lg:block">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Buscar placa o cliente..." value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && busqueda.trim()) { navigate(`/ingresos`); setBusqueda(""); } }}
                className="w-44 xl:w-56 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 placeholder:text-slate-400 outline-none focus:border-teal-400 dark:focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
              />
            </div>
            <CajaStatusWidget />
            <CampanaNotificaciones />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6 bg-white dark:bg-slate-900">
          <Outlet />
          {CajaRecordatorioBanner}
        </main>
      </div>
    </div>
  );
}

export default MainLayout;

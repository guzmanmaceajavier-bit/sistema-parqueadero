import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import {
  LayoutDashboard, Car, Users, LayoutGrid, LogIn, CalendarClock,
  CalendarCheck, ParkingMeter, Wallet, FileText, Receipt,
  ArrowRightLeft, Tag, Crown, UserCog, Building2, Settings,
  ChevronDown, PanelLeftClose, PanelLeft, Database, BarChart3
} from "lucide-react";

export default function Sidebar({ abierto, onToggle, colapsado: colapsadoExt, onColapsar }) {
  const navigate = useNavigate();
  const { user, logout: authLogout, isAdmin, isSupervisor, isAuthenticated } = useAuth();
  const { config, toggleModoOscuro } = useConfig();
  const location = useLocation();
  const pathname = location.pathname;
  const rol = user?.rol || "empleado";
  const oscuro = config?.modoOscuro;

  const colapsado = colapsadoExt ?? false;
  const [sClientes, setSClientes] = useState(true);
  const [sParqueadero, setSParqueadero] = useState(true);
  const [sMovEntrada, setSMovEntrada] = useState(true);
  const [sSuscripciones, setSSuscripciones] = useState(true);
  const [sCaja, setSCaja] = useState(true);
  const [sAuditoria, setSAuditoria] = useState(false);
  const [sConfig, setSConfig] = useState(true);
  const [mostrarLogout, setMostrarLogout] = useState(false);
  const [popoverSeccion, setPopoverSeccion] = useState(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setPopoverSeccion(null);
      }
    };
    if (popoverSeccion) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [popoverSeccion]);

  useEffect(() => {
    const routes = {
      clientes: ["/clientes", "/vehiculos"],
      parqueadero: ["/puestos"],
      "mov-entrada": ["/ingresos", "/reservas"],
      suscripciones: ["/mensualidades", "/ausencias"],
      "caja-section": ["/caja", "/facturas", "/gastos"],
      auditoria: ["/movimientos", "/reportes"],
      config: ["/tarifas", "/planes", "/usuarios", "/sucursales", "/backup", "/configuracion"],
    };
    for (const [id, paths] of Object.entries(routes)) {
      if (paths.some(p => pathname === p)) {
        const setter = { clientes: setSClientes, parqueadero: setSParqueadero, "mov-entrada": setSMovEntrada, suscripciones: setSSuscripciones, "caja-section": setSCaja, auditoria: setSAuditoria, config: setSConfig }[id];
        if (setter) setter(true);
      }
    }
  }, [pathname]);

  const isActive = (p) => pathname === p;
  const initial = (user?.usuario || "U").charAt(0).toUpperCase();

  const handleLogout = () => {
    authLogout();
    navigate("/", { replace: true });
  };

  const activeClass = "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300";

  const hoverClass = "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white";

  const borderClass = "border-slate-200 dark:border-white/10";

  const borderSub = "border-slate-200 dark:border-white/5";

  const textBody = "text-slate-800 dark:text-white";

  const textSecondary = "text-slate-500 dark:text-slate-400";

  const bgBody = "bg-white dark:bg-slate-900";

  const subHover = "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white";

  const hoverDanger = "text-slate-600 hover:bg-red-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-500/10 dark:hover:text-red-400";

  function NavItem({ to, icon: Icon, children }) {
    const active = isActive(to);
    return (
      <Link to={to} title={colapsado ? children : undefined}
        className={`group flex items-center ${colapsado ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${active ? activeClass : hoverClass}`}>
        <Icon className={`${colapsado ? "w-6 h-6" : "w-5 h-5"} shrink-0`} />
        {!colapsado && children}
      </Link>
    );
  }

  function SubLink({ to, icon: Icon, children }) {
    const active = isActive(to);
    return (
      <Link to={to} onClick={() => setPopoverSeccion(null)}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${active ? activeClass : subHover}`}>
        <Icon className="w-4 h-4 shrink-0" />
        {children}
      </Link>
    );
  }

  function Submenu({ open, children }) {
    return (
      <div className={`ml-2 pl-2 border-l ${borderSub} overflow-hidden transition-all duration-300 ease-in-out`}
        style={{ maxHeight: open ? "500px" : "0", opacity: open ? 1 : 0 }}>
        <div className="space-y-0.5 py-1">{children}</div>
      </div>
    );
  }

  function Section({ label, icon: Icon, color, open, onToggle, children, id }) {
    const sectionRef = useRef(null);
    return (
      <div ref={sectionRef}>
        <div
          onClick={() => {
            if (colapsado) {
              setPopoverSeccion(popoverSeccion === id ? null : id);
            } else {
              onToggle();
            }
          }}
          className={`flex items-center ${colapsado ? "justify-center" : "justify-between"} px-3 py-1.5 group/section cursor-pointer ${colapsado ? "py-2.5" : ""} rounded-lg transition-all duration-200 ${popoverSeccion === id ? "bg-slate-100 dark:bg-white/10" : ""} ${colapsado ? hoverClass : ""}`}>
          <div className={`flex items-center ${colapsado ? "" : "gap-1.5"}`}>
            <Icon className={`${colapsado ? "w-5 h-5" : "w-4 h-4"} ${color}`} />
            {!colapsado && <span className={`text-[10px] font-semibold uppercase tracking-widest ${color}`}>{label}</span>}
          </div>
          {!colapsado && (
            <button onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className={`p-1 rounded-md transition-all duration-200 cursor-pointer opacity-0 group-hover/section:opacity-100 ${hoverClass}`}>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
        {!colapsado && children}

        {colapsado && popoverSeccion === id && (
          <div ref={popoverRef}
            className={`fixed z-[70] w-48 rounded-xl shadow-2xl border ${borderClass} ${bgBody} py-2 overflow-hidden`}
            style={{
              top: (sectionRef.current?.getBoundingClientRect().bottom || 0) + 2,
              left: Math.max(4, sectionRef.current?.getBoundingClientRect().left || 0),
            }}>
            <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest ${color} border-b ${borderSub} mb-1`}>{label}</div>
            {children.props?.children?.map?.((child, i) => {
              if (!child) return null;
              const c = child.props;
              const act = isActive(c.to);
              return (
                <Link key={i} to={c.to} onClick={() => setPopoverSeccion(null)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200 ${act ? activeClass : subHover}`}>
                  {c.icon && <c.icon className="w-5 h-5 shrink-0" />}
                  {c.children}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function Divider() {
    return <div className={`mx-3 my-2 border-t ${borderSub} ${colapsado ? "mx-2" : ""}`} />;
  }

  if (!isAuthenticated) return null;

  const sidebarW = colapsado ? "w-16" : "w-64";

  const nav = (
    <>
      <div className={`px-3 pt-3 pb-2 border-b ${borderClass} ${colapsado ? "flex justify-center" : ""}`}>
          <div className={`flex items-center ${colapsado ? "justify-center" : "gap-2"}`}>
          {!colapsado && (
            <>
              <div className="min-w-0 flex-1">
                <h1 className={`text-sm font-bold leading-tight truncate ${textBody}`}>{config?.nombreParqueadero || "Parqueadero"}</h1>
                <p className={`text-[9px] font-medium ${textSecondary} truncate leading-tight`}>Panel de control</p>
              </div>
              <button onClick={onColapsar} title="Colapsar sidebar"
                className={`p-1 rounded-lg transition-all duration-200 cursor-pointer ${hoverClass}`}>
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {colapsado && (
            <button onClick={onColapsar} title="Expandir sidebar"
              className={`p-1 rounded-lg transition-all duration-200 cursor-pointer ${hoverClass}`}>
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {colapsado ? (
        <nav className="flex-1 flex flex-col overflow-y-auto py-2">
          <div className="flex flex-col items-center gap-0.5 px-1">
            <NavItem to="/dashboard" icon={LayoutDashboard}>Dashboard</NavItem>
            <Divider />
            <Section id="clientes" label="Clientes" icon={Users} color="text-emerald-600 dark:text-emerald-400" open={sClientes} onToggle={() => setSClientes(!sClientes)}>
              <Submenu open={sClientes}>
                <SubLink to="/clientes" icon={Users}>Registro</SubLink>
                <SubLink to="/vehiculos" icon={Car}>Vehiculos</SubLink>
              </Submenu>
            </Section>
            <Section id="parqueadero" label="Parqueadero" icon={LayoutGrid} color="text-emerald-600 dark:text-emerald-400" open={sParqueadero} onToggle={() => setSParqueadero(!sParqueadero)}>
              <Submenu open={sParqueadero}>
                <SubLink to="/puestos" icon={LayoutGrid}>Puestos</SubLink>
              </Submenu>
            </Section>
            <Divider />
            <Section id="mov-entrada" label="Mov. Entrada" icon={LogIn} color="text-blue-600 dark:text-blue-400" open={sMovEntrada} onToggle={() => setSMovEntrada(!sMovEntrada)}>
              <Submenu open={sMovEntrada}>
                <SubLink to="/ingresos" icon={ArrowRightLeft}>Entradas / Salidas</SubLink>
                <SubLink to="/reservas" icon={CalendarCheck}>Reservas</SubLink>
              </Submenu>
            </Section>
            <Section id="suscripciones" label="Suscripciones" icon={CalendarClock} color="text-blue-600 dark:text-blue-400" open={sSuscripciones} onToggle={() => setSSuscripciones(!sSuscripciones)}>
              <Submenu open={sSuscripciones}>
                <SubLink to="/mensualidades" icon={CalendarClock}>Suscripciones</SubLink>
                <SubLink to="/ausencias" icon={CalendarClock}>Ausencias</SubLink>
              </Submenu>
            </Section>
            <Divider />
            <Section id="caja-section" label="Caja" icon={Wallet} color="text-amber-600 dark:text-amber-400" open={sCaja} onToggle={() => setSCaja(!sCaja)}>
              <Submenu open={sCaja}>
                <SubLink to="/caja" icon={Wallet}>Estado</SubLink>
                <SubLink to="/facturas" icon={FileText}>Facturas</SubLink>
                <SubLink to="/gastos" icon={Receipt}>Gastos</SubLink>
              </Submenu>
            </Section>
            <Section id="auditoria" label="Auditoria" icon={ArrowRightLeft} color="text-amber-600 dark:text-amber-400" open={sAuditoria} onToggle={() => setSAuditoria(!sAuditoria)}>
              <Submenu open={sAuditoria}>
                <SubLink to="/movimientos" icon={ArrowRightLeft}>Movimientos</SubLink>
                <SubLink to="/reportes" icon={BarChart3}>Reportes</SubLink>
              </Submenu>
            </Section>
            {(isAdmin || isSupervisor) && (
              <>
                <Divider />
                <Section id="config" label="Configuracion" icon={Settings} color="text-slate-500 dark:text-slate-300" open={sConfig} onToggle={() => setSConfig(!sConfig)}>
                  <Submenu open={sConfig}>
                    <SubLink to="/tarifas" icon={Tag}>Precios por Tiempo</SubLink>
                    <SubLink to="/planes" icon={Crown}>Planes</SubLink>
                    {isAdmin && <SubLink to="/usuarios" icon={UserCog}>Usuarios</SubLink>}
                    {isAdmin && <SubLink to="/sucursales" icon={Building2}>Sucursales</SubLink>}
                    {isAdmin && <SubLink to="/backup" icon={Database}>Backup</SubLink>}
                    <SubLink to="/configuracion" icon={Settings}>General</SubLink>
                  </Submenu>
                </Section>
              </>
            )}
          </div>
          <div className="flex-1 min-h-0" />
            <div className="flex flex-col items-center gap-0.5 px-1 pt-1">
              <div className={`w-5 h-px ${borderSub} mb-1`} />
              <button onClick={toggleModoOscuro} title={oscuro ? "Modo claro" : "Modo oscuro"}
              className={`p-2 rounded-lg transition-all duration-200 cursor-pointer ${hoverClass}`}>
              {oscuro
                ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
                : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>}
            </button>
            <button onClick={() => setMostrarLogout(true)} title="Cerrar sesion"
              className={`p-2 rounded-lg transition-all duration-200 cursor-pointer ${hoverDanger}`}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            </button>
            <button onClick={onColapsar} title="Expandir sidebar"
              className={`p-2 rounded-lg transition-all duration-200 cursor-pointer ${hoverClass}`}>
              <PanelLeft className="w-5 h-5" />
            </button>
          </div>
        </nav>
      ) : (
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <NavItem to="/dashboard" icon={LayoutDashboard}>Dashboard</NavItem>
          <Divider />
          <Section id="clientes" label="Clientes" icon={Users} color="text-emerald-600 dark:text-emerald-400" open={sClientes} onToggle={() => setSClientes(!sClientes)}>
            <Submenu open={sClientes}>
              <SubLink to="/clientes" icon={Users}>Registro</SubLink>
              <SubLink to="/vehiculos" icon={Car}>Vehiculos</SubLink>
            </Submenu>
          </Section>
          <Section id="parqueadero" label="Parqueadero" icon={LayoutGrid} color="text-emerald-600 dark:text-emerald-400" open={sParqueadero} onToggle={() => setSParqueadero(!sParqueadero)}>
            <Submenu open={sParqueadero}>
              <SubLink to="/puestos" icon={LayoutGrid}>Puestos</SubLink>
            </Submenu>
          </Section>
          <Divider />
          <Section id="mov-entrada" label="Mov. Entrada" icon={LogIn} color="text-blue-600 dark:text-blue-400" open={sMovEntrada} onToggle={() => setSMovEntrada(!sMovEntrada)}>
            <Submenu open={sMovEntrada}>
              <SubLink to="/ingresos" icon={ArrowRightLeft}>Entradas / Salidas</SubLink>
              <SubLink to="/reservas" icon={CalendarCheck}>Reservas</SubLink>
            </Submenu>
          </Section>
          <Section id="suscripciones" label="Suscripciones" icon={CalendarClock} color="text-blue-600 dark:text-blue-400" open={sSuscripciones} onToggle={() => setSSuscripciones(!sSuscripciones)}>
            <Submenu open={sSuscripciones}>
              <SubLink to="/mensualidades" icon={CalendarClock}>Suscripciones</SubLink>
              <SubLink to="/ausencias" icon={CalendarClock}>Ausencias</SubLink>
            </Submenu>
          </Section>
          <Divider />
          <Section id="caja-section" label="Caja" icon={Wallet} color="text-amber-600 dark:text-amber-400" open={sCaja} onToggle={() => setSCaja(!sCaja)}>
            <Submenu open={sCaja}>
              <SubLink to="/caja" icon={Wallet}>Estado</SubLink>
              <SubLink to="/facturas" icon={FileText}>Facturas</SubLink>
              <SubLink to="/gastos" icon={Receipt}>Gastos</SubLink>
            </Submenu>
          </Section>
          <Section id="auditoria" label="Auditoria" icon={ArrowRightLeft} color="text-amber-600 dark:text-amber-400" open={sAuditoria} onToggle={() => setSAuditoria(!sAuditoria)}>
            <Submenu open={sAuditoria}>
              <SubLink to="/movimientos" icon={ArrowRightLeft}>Movimientos</SubLink>
              <SubLink to="/reportes" icon={BarChart3}>Reportes</SubLink>
            </Submenu>
          </Section>
          {(isAdmin || isSupervisor) && (
            <>
              <Divider />
              <Section id="config" label="Configuracion" icon={Settings} color="text-slate-500 dark:text-slate-300" open={sConfig} onToggle={() => setSConfig(!sConfig)}>
                <Submenu open={sConfig}>
                  <SubLink to="/tarifas" icon={Tag}>Precios por Tiempo</SubLink>
                  <SubLink to="/planes" icon={Crown}>Planes</SubLink>
                  {isAdmin && <SubLink to="/usuarios" icon={UserCog}>Usuarios</SubLink>}
                  {isAdmin && <SubLink to="/sucursales" icon={Building2}>Sucursales</SubLink>}
                  {isAdmin && <SubLink to="/backup" icon={Database}>Backup</SubLink>}
                  <SubLink to="/configuracion" icon={Settings}>General</SubLink>
                </Submenu>
              </Section>
            </>
          )}
          <div className={`border-t ${borderClass} px-2 py-2 mt-2`}>
            <div className={`flex items-center gap-2 px-2`}>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium truncate ${textBody}`}>{user?.usuario || "admin"}</p>
                <p className={`text-[10px] capitalize truncate ${textSecondary}`}>{rol === "admin" ? "admin" : rol === "supervisor" ? "supervisor" : "trabajador"}</p>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={toggleModoOscuro} title={oscuro ? "Modo claro" : "Modo oscuro"}
                  className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${hoverClass}`}>
                  {oscuro
                    ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
                    : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>}
                </button>
                <button onClick={() => setMostrarLogout(true)} title="Cerrar sesion"
                  className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${hoverDanger}`}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                </button>
              </div>
            </div>
          </div>
        </nav>
      )}
    </>
  );

  return (
    <>
      {abierto && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onToggle} />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 ${sidebarW} flex flex-col transform transition-all duration-300 lg:translate-x-0 ${bgBody} ${abierto ? "translate-x-0" : "-translate-x-full"}`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b lg:hidden ${borderClass}`}>
          <div className="flex items-center gap-2">
            <div>
              <h1 className={`text-sm font-bold leading-tight ${textBody}`}>{config?.nombreParqueadero || "Parqueadero"}</h1>
              <p className={`text-[10px] ${textSecondary}`}>Menú</p>
            </div>
          </div>
          <button onClick={onToggle} className={`p-1.5 rounded-lg transition-all cursor-pointer ${hoverClass}`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        {nav}
      </aside>

      {mostrarLogout && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMostrarLogout(false)} />
          <div className={`relative rounded-2xl shadow-2xl p-6 w-80 mx-4 border ${borderClass} bg-white dark:bg-slate-800`}>
            <h3 className={`text-lg font-bold mb-2 ${textBody}`}>Cerrar Sesion</h3>
            <p className={`text-sm mb-6 ${textSecondary}`}>¿Estas seguro que quieres salir?</p>
            <div className="flex gap-3">
              <button onClick={() => setMostrarLogout(false)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${hoverClass} bg-white/10 dark:bg-white/10`}>
                No
              </button>
              <button onClick={() => { setMostrarLogout(false); handleLogout(); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-all cursor-pointer">
                Si, salir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

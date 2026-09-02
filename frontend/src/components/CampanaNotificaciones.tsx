import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotificaciones } from "../context/NotificacionContext";
import { Bell, ArrowRightFromLine, ArrowLeftToLine, DollarSign, X, AlertTriangle, Trash2 } from "lucide-react";

const ICONOS_TIPO: Record<string, React.ReactNode> = {
  entrada: <ArrowRightFromLine className="w-4 h-4 text-emerald-500" />,
  salida: <ArrowLeftToLine className="w-4 h-4 text-red-500" />,
  caja: <DollarSign className="w-4 h-4 text-amber-500" />,
  alerta: <AlertTriangle className="w-4 h-4 text-red-500" />,
};

export default function CampanaNotificaciones() {
  const { notificaciones, noLeidas, conectado, marcarLeidas, limpiarNotificaciones } = useNotificaciones();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleClickNotif = (n: typeof notificaciones[0]) => {
    if (n.enlace) {
      navigate(n.enlace);
      setAbierto(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setAbierto(!abierto); if (!abierto) marcarLeidas(); }} className="relative p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
        <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 max-h-96 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <p className="text-sm font-bold text-slate-800 dark:text-white">Notificaciones</p>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${conectado ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className="text-xs text-slate-400">{conectado ? "En vivo" : "Desconectado"}</span>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {notificaciones.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">Sin notificaciones</div>
            ) : (
              notificaciones.map((n) => (
                <div key={n.id} onClick={() => handleClickNotif(n)}
                  className={`px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${n.leida ? "" : "bg-teal-50/50 dark:bg-teal-900/10"} ${n.enlace ? "cursor-pointer" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5">{ICONOS_TIPO[n.tipo] || ICONOS_TIPO.entrada}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{n.titulo}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.mensaje}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{new Date(n.fecha).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hourCycle: "h12" })}</p>
                    </div>
                    {n.enlace && <span className="text-[10px] text-teal-500 dark:text-teal-400 shrink-0 mt-1">Ver →</span>}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-700">
            {notificaciones.length > 0 && (
              <button onClick={() => { limpiarNotificaciones(); setAbierto(false); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                <Trash2 className="w-3 h-3" /> Limpiar
              </button>
            )}
            <button onClick={() => setAbierto(false)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer ml-auto">
              <X className="w-3 h-3" /> Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

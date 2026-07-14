import { X, ParkingCircle, MapPin, Car, User, Pencil, Trash2, Wrench, ArrowUpFromLine, Plus, CalendarClock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getEstadoConfig } from "./puesto.constants";
import { getZonaColor } from "./puesto.helpers";

const gradientes = {
  LIBRE: "from-emerald-600 to-emerald-500",
  OCUPADO: "from-red-600 to-red-500",
  RESERVADO: "from-amber-600 to-amber-500",
  MANTENIMIENTO: "from-slate-600 to-slate-500",
  AUSENCIA: "from-purple-600 to-purple-500",
};

export default function PuestoDetailModal({ puesto, onClose, onEdit, onLiberar, onAsignar, onMantenimiento, onFinalizarAusencia, onDelete, mostrarConfirm }) {
  const navigate = useNavigate();
  if (!puesto) return null;

  const config = getEstadoConfig(puesto.estado);
  const zonaColor = getZonaColor(puesto.zona);
  const hoy = new Date();
  const ing = puesto.ingresos?.[0];
  const men = puesto.mensualidades?.[0];
  const res = puesto.reservas?.[0];
  const tipos = (puesto.tipoPuesto || "").split(",").map(t => t.trim()).filter(Boolean);
  const grad = gradientes[puesto.estado] || "from-slate-600 to-slate-500";
  const mensualidadVencida = men && new Date(men.fechaFin) < hoy;
  const tipoEstadia = men ? `Plan: ${men.plan?.nombre || "Mensualidad"}` : "Por hora/día";
  const mostrarAsignar = puesto.estado === "LIBRE";
  const mostrarLiberar = puesto.estado === "OCUPADO";
  const mostrarMant = puesto.estado !== "MANTENIMIENTO" && puesto.estado !== "OCUPADO" && puesto.estado !== "AUSENCIA";

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-start pt-8 pb-8 px-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[calc(100vh-4rem)] overflow-y-auto animate-modal-in">
        <div className={`relative bg-gradient-to-br ${grad} px-5 pt-5 pb-14`}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white" />
            <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white" />
            <div className="absolute top-4 right-12 w-16 h-16 rounded-full bg-white" />
          </div>
          <button onClick={onClose} className="relative z-10 ml-auto block p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all">
            <X className="w-4 h-4" />
          </button>
          <div className="relative z-10 -mt-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
                <ParkingCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white drop-shadow-sm">Puesto {puesto.codigo}</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-white/90" />
                  <p className="text-xs font-semibold text-white/90 uppercase tracking-wider">{config.label}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 -mt-8 space-y-3 pb-5 relative z-10">
          {puesto.zona && (
            <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-600 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-slate-500 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Zona</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: zonaColor }} />
                  {puesto.zona}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-3.5">
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-600 flex items-center justify-center shrink-0">
                <Car className="w-4 h-4 text-slate-500 dark:text-slate-300" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tipo vehículo</p>
            </div>
            <div className="flex flex-wrap gap-1.5 pl-0.5">
              {tipos.map(t => (
                <span key={t} className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-500 bg-slate-50 dark:bg-slate-600 text-slate-700 dark:text-slate-200 capitalize shadow-sm">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {puesto.estado === "LIBRE" && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-700/50 p-4 text-center">
              <ParkingCircle className="w-8 h-8 mx-auto text-emerald-500 dark:text-emerald-400 mb-1.5" />
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Puesto libre</p>
            </div>
          )}

          {res && puesto.estado === "RESERVADO" && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700/50 overflow-hidden">
              <div className="bg-amber-500/10 px-4 py-2 border-b border-amber-200 dark:border-amber-700/50">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Reserva activa
                </p>
              </div>
              <div className="p-4 space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Cliente</span><span className="font-semibold text-slate-800 dark:text-white text-right">{res.cliente?.nombres} {res.cliente?.apellidos}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Doc</span><span className="text-slate-700 dark:text-slate-300">{res.cliente?.documento || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Vehículo</span><span className="font-mono font-semibold dark:text-white">{res.vehiculo?.placa}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Estado</span><span className="font-semibold dark:text-white capitalize">{res.estado}</span></div>
              </div>
              <button onClick={() => { onClose(); navigate("/reservas"); }} className="w-full py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors uppercase tracking-wider">Ir a Reservas</button>
            </div>
          )}

          {ing && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-700/50 overflow-hidden">
              <div className="bg-red-500/10 px-4 py-2 border-b border-red-200 dark:border-red-700/50">
                <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Ingreso activo · {tipoEstadia}
                </p>
              </div>
              <div className="p-4 space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Cliente</span><span className="font-semibold text-slate-800 dark:text-white text-right">{ing.cliente?.nombres} {ing.cliente?.apellidos}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Doc</span><span className="text-slate-700 dark:text-slate-300">{ing.cliente?.documento || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Vehículo</span><span className="font-mono font-semibold dark:text-white">{ing.vehiculo?.placa}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Tipo</span><span className="capitalize dark:text-slate-300">{ing.vehiculo?.tipo || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Entrada</span><span className="font-medium dark:text-white">{new Date(ing.fechaEntrada).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h12" })}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Tiempo</span><span className="font-medium dark:text-white">{Math.floor((Date.now() - new Date(ing.fechaEntrada)) / 60000)} min</span></div>
              </div>
            </div>
          )}

          {men && (
            <div className={`rounded-xl border overflow-hidden ${mensualidadVencida ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50' : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700/50'}`}>
              <div className={`px-4 py-2 border-b ${mensualidadVencida ? 'bg-red-500/10 border-red-200 dark:border-red-700/50' : 'bg-purple-500/10 border-purple-200 dark:border-purple-700/50'}`}>
                <p className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${mensualidadVencida ? 'text-red-700 dark:text-red-400' : 'text-purple-700 dark:text-purple-400'}`}>
                  {mensualidadVencida ? 'Mensualidad VENCIDA' : 'Mensualidad activa'}
                </p>
              </div>
              <div className="p-4 space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Cliente</span><span className="font-semibold text-slate-800 dark:text-white text-right">{men.cliente?.nombres} {men.cliente?.apellidos}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Vehículo</span><span className="font-mono font-semibold dark:text-white">{men.vehiculo?.placa}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Plan</span><span className="dark:text-slate-300">{men.plan?.nombre || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Inicio</span><span className="font-medium dark:text-white">{new Date(men.fechaInicio).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Fin</span><span className="font-medium dark:text-white">{new Date(men.fechaFin).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Valor</span><span className="font-semibold dark:text-white">${Number(men.valor).toLocaleString()}</span></div>
                {men.plan?.duracionDias && (() => {
                  const inicio = new Date(men.fechaInicio);
                  const fin = new Date(men.fechaFin);
                  const totalDias = men.plan.duracionDias;
                  const transcurridos = Math.max(0, Math.min(totalDias, Math.floor((Date.now() - inicio.getTime()) / 86400000) + 1));
                  const pct = Math.round((transcurridos / totalDias) * 100);
                  return (<>
                    <div className="flex justify-between text-xs"><span className="text-slate-400">Días usados</span><span className="font-medium dark:text-white">{transcurridos} / {totalDias}</span></div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-purple-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </>);
                })()}
              </div>
              <button onClick={() => { onClose(); navigate("/mensualidades"); }} className="w-full py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50">Ir a Tarifas Fijas</button>
            </div>
          )}

          {puesto.estado === "MANTENIMIENTO" && (
            <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 p-4 text-center">
              <Wrench className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500 mb-1.5" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Puesto en mantenimiento</p>
            </div>
          )}

          {puesto.estado === "AUSENCIA" && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700/50 p-4 text-center">
              <User className="w-8 h-8 mx-auto text-purple-500 dark:text-purple-400 mb-1.5" />
              <p className="text-sm font-bold text-purple-700 dark:text-purple-400">Cliente ausente</p>
              {(ing || men) && (
                <div className="mt-2 text-xs text-purple-600 dark:text-purple-300 space-y-0.5">
                  <p>{ing?.cliente?.nombres || men?.cliente?.nombres} {ing?.cliente?.apellidos || men?.cliente?.apellidos}</p>
                  <p className="font-mono">{ing?.vehiculo?.placa || men?.vehiculo?.placa}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {mostrarAsignar && (
              <>
                <button onClick={() => { onClose(); onAsignar(puesto); }} className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Asignar vehículo
                </button>
                <button onClick={() => { onClose(); navigate("/reservas", { state: { puestoId: puesto.id, puestoCodigo: puesto.codigo } }); }} className="w-full py-3 text-sm font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <CalendarClock className="w-4 h-4" /> Reservar puesto
                </button>
              </>
            )}
            {mostrarLiberar && (
              <button onClick={() => { mostrarConfirm("Liberar puesto", men ? "El plan sigue activo — el cliente puede regresar. Se finaliza solo el ingreso actual." : "Se finalizará el ingreso actual y el puesto quedará libre.", () => { onLiberar(puesto); onClose(); }); }} className="w-full py-3 text-sm font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <ArrowUpFromLine className="w-4 h-4" /> Liberar puesto
              </button>
            )}
            {mostrarMant && (
              <button onClick={() => { mostrarConfirm("Mantenimiento", "El puesto quedará fuera de servicio.", () => { onMantenimiento(puesto); onClose(); }); }} className="w-full py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <Wrench className="w-4 h-4" /> Marcar mantenimiento
              </button>
            )}
            {puesto.estado === "AUSENCIA" && (
              <button onClick={() => { mostrarConfirm("Finalizar ausencia", "El dueño ha regresado. Se finalizará la ausencia y el puesto quedará disponible.", () => { onFinalizarAusencia(puesto); onClose(); }); }} className="w-full py-3 text-sm font-semibold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700/50 hover:bg-purple-100 dark:hover:bg-purple-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <User className="w-4 h-4" /> Finalizar ausencia
              </button>
            )}
            <button onClick={() => { onClose(); onEdit(puesto); }} className="w-full py-3 text-sm font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700/50 hover:bg-blue-100 dark:hover:bg-blue-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <Pencil className="w-4 h-4" /> Editar puesto
            </button>
            <button onClick={() => {
              const msg = men
                ? `El cliente ${men.cliente?.nombres || ""} ${men.cliente?.apellidos || ""} tiene el plan "${men.plan?.nombre || "—"}" activo. ¿Deseas eliminar el puesto? Se cancelará su plan.`
                : "Se borrarán ingresos, mensualidades y reservas asociados.";
              mostrarConfirm("Eliminar puesto", msg, () => { const id = puesto.id; onClose(); setTimeout(() => onDelete(id), 100); });
            }} className="w-full py-3 text-sm font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-700/50 hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

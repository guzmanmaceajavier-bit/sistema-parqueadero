import { getEstadoConfig } from "./puesto.constants";
import { getZonaColor } from "./puesto.helpers";

export default function PuestoCard({ puesto, onDetalle }) {
  const config = getEstadoConfig(puesto.estado);
  const hoy = new Date();
  const ingresoActivo = puesto.ingresos?.[0];
  const mensualidadActiva = puesto.mensualidades?.[0];
  const reservaActiva = puesto.reservas?.[0];
  const ocupante = ingresoActivo || mensualidadActiva;
  const infoReserva = puesto.estado === "RESERVADO" && reservaActiva;
  const mensualidadVencida = mensualidadActiva && new Date(mensualidadActiva.fechaFin) < hoy;
  const zonaColor = getZonaColor(puesto.zona);

  const tipoEstadia = mensualidadActiva ? `Plan: ${mensualidadActiva.plan?.nombre || "Mensualidad"}` : "Por hora/día";

  return (
    <div
      className={`relative p-3 rounded-xl border-2 ${config.bg} transition-all duration-200 cursor-pointer hover:shadow-md active:scale-[0.98]`}
      style={zonaColor ? { borderLeftColor: zonaColor, borderLeftWidth: 4 } : {}}
      onClick={() => onDetalle?.(puesto)}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.text}`}>{config.label}</span>
        {puesto.zona && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shadow-sm ml-auto" style={{ backgroundColor: zonaColor }}>
            {puesto.zona}
          </span>
        )}
      </div>
      <p className="text-base font-bold font-mono tracking-tight">{puesto.codigo}</p>
      {infoReserva && (
        <div className="mt-1.5 pt-1.5 border-t border-current/20 text-[11px] space-y-0.5">
          <p className="font-semibold truncate">{reservaActiva.cliente?.nombres} {reservaActiva.cliente?.apellidos}</p>
          <p className="font-mono opacity-75">{reservaActiva.vehiculo?.placa} · Reserva</p>
        </div>
      )}
      {puesto.estado === "AUSENCIA" && ocupante && (
        <div className="mt-1.5 pt-1.5 border-t border-current/20 text-[11px] space-y-0.5">
          <p className="text-[9px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">AUSENTE</p>
          <p className="font-semibold truncate">{ocupante.cliente?.nombres} {ocupante.cliente?.apellidos}</p>
          <p className="font-mono opacity-75">{ocupante.vehiculo?.placa}</p>
        </div>
      )}
      {ocupante && !infoReserva && puesto.estado !== "AUSENCIA" && (
        <div className="mt-1.5 pt-1.5 border-t border-current/20 text-[11px] space-y-0.5">
          {mensualidadVencida && (
            <p className="text-[9px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">VENCIDA</p>
          )}
          <p className="font-semibold truncate">{ocupante.cliente?.nombres} {ocupante.cliente?.apellidos}</p>
          <p className="font-mono opacity-75">{ocupante.vehiculo?.placa} · {tipoEstadia}</p>
        </div>
      )}
    </div>
  );
}

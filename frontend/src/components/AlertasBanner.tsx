import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useNotificaciones } from "../context/NotificacionContext";
import { User, Calendar, Clock, Truck, CalendarCheck, DollarSign, AlertTriangle } from "lucide-react";

const ICONOS = {
  usuario: <User className="w-5 h-5" />,
  calendario: <Calendar className="w-5 h-5" />,
  reloj: <Clock className="w-5 h-5" />,
  vehiculo: <Truck className="w-5 h-5" />,
  reserva: <CalendarCheck className="w-5 h-5" />,
  caja: <DollarSign className="w-5 h-5" />,
  ausencia: <AlertTriangle className="w-5 h-5" />,
};

const ESTILOS = {
  peligro: "bg-red-50 border-red-200 text-red-800",
  advertencia: "bg-amber-50 border-amber-200 text-amber-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
};

export default function AlertasBanner() {
  const [alertas, setAlertas] = useState([]);
  const [visible, setVisible] = useState(true);
  const { conectado } = useNotificaciones();

  const cargarAlertas = useCallback(async () => {
    try {
      const res = await api.get("/alertas");
      setAlertas(res.data.alertas || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { cargarAlertas(); const iv = setInterval(cargarAlertas, 60000); return () => clearInterval(iv); }, [cargarAlertas]);

  useEffect(() => {
    if (conectado) cargarAlertas();
  }, [conectado, cargarAlertas]);

  if (alertas.length === 0 || !visible) return null;

  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{`Alertas (${alertas.length})`}</p>
        <button onClick={() => setVisible(false)} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">Ocultar</button>
      </div>
      <div className="space-y-2">
        {alertas.map((a, i) => (
          <Link key={i} to={a.enlace} className={`flex items-start gap-3 p-3 rounded-lg border ${ESTILOS[a.tipo]} transition-all hover:shadow-sm`}>
            <span className="flex-shrink-0 mt-0.5">{ICONOS[a.icono] || ICONOS.usuario}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{a.titulo}</p>
              <p className="text-xs mt-0.5 opacity-80 line-clamp-2">{a.descripcion}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

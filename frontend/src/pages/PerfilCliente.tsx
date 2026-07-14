import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Car, Calendar, Clock, DollarSign, User, Phone, Mail, MapPin, Receipt, MessageCircle } from "lucide-react";
import api from "../services/api";

export default function PerfilCliente() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api.get(`/clientes/${id}/perfil`).then(r => setData(r.data.cliente)).catch(err => {
      setError(err.response?.data?.message || err.message || "Error al cargar perfil");
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-400 dark:text-slate-500">Cargando...</div>;
  if (error) return <div className="p-8 text-center text-red-500 dark:text-red-400">{error}</div>;
  if (!data) return <div className="p-8 text-center text-slate-400 dark:text-slate-500">Sin datos del cliente</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto dark:bg-slate-900">
      <Link to="/clientes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 mb-4">
        <ArrowLeft size={16} /> Volver a clientes
      </Link>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <User size={28} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{data.nombres} {data.apellidos}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
              {data.telefono && <span className="flex items-center gap-1"><Phone size={14} /> {data.telefono}</span>}
              {data.email && <span className="flex items-center gap-1"><Mail size={14} /> {data.email}</span>}
              {data.direccion && <span className="flex items-center gap-1"><MapPin size={14} /> {data.direccion}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            {data.telefono && (
              <button onClick={() => {
                const msg = encodeURIComponent(`Hola ${data.nombres}, te recordamos tu visita al parqueadero.`);
                window.open(`https://wa.me/57${data.telefono}?text=${msg}`, "_blank");
              }} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
                <MessageCircle className="w-3.5 h-3.5" /> Enviar recordatorio
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl px-4 py-3">
              <div className="text-2xl font-bold text-slate-800 dark:text-white">{data.totalVisitas || 0}</div>
              <div className="text-xs text-slate-400 dark:text-slate-500">Visitas</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl px-4 py-3">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${(data.totalGastado || 0).toFixed(0)}</div>
              <div className="text-xs text-slate-400 dark:text-slate-500">Gastado</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl px-4 py-3">
              <div className={`text-2xl font-bold ${data.deudaPendiente > 0 ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-white"}`}>
                ${(data.deudaPendiente || 0).toFixed(0)}
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500">Deuda</div>
            </div>
          </div>
        </div>
      </div>

      {data.vehiculos?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Car size={20} /> Vehiculos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.vehiculos.map(v => (
              <div key={v.id} className="border border-slate-200 dark:border-slate-600 rounded-xl p-3">
                <div className="font-bold text-slate-800 dark:text-white">{v.placa}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{v.marca} {v.modelo} ({v.tipo || "—"})</div>
                {v.color && <div className="text-xs text-slate-400 dark:text-slate-500">Color: {v.color}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Clock size={20} /> Historial de ingresos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="text-left py-2 px-2">Fecha</th>
                <th className="text-left py-2 px-2">Placa</th>
                <th className="text-left py-2 px-2">Puesto</th>
                <th className="text-left py-2 px-2">Ingreso</th>
                <th className="text-left py-2 px-2">Salida</th>
                <th className="text-right py-2 px-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {(data.historial || []).map((item, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="py-2 px-2 text-slate-600 dark:text-slate-300">{new Date(item.fechaEntrada).toLocaleDateString("es-CO")}</td>
                  <td className="py-2 px-2 font-mono font-bold text-slate-800 dark:text-white">{item.placa}</td>
                  <td className="py-2 px-2 text-slate-600 dark:text-slate-300">{item.puesto?.codigo || "—"}</td>
                  <td className="py-2 px-2 text-slate-600 dark:text-slate-300">{new Date(item.fechaEntrada).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hourCycle: "h12" })}</td>
                  <td className="py-2 px-2 text-slate-600 dark:text-slate-300">{item.fechaSalida ? new Date(item.fechaSalida).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hourCycle: "h12" }) : "—"}</td>
                  <td className="py-2 px-2 text-right font-medium text-slate-800 dark:text-white">${(item.factura?.valor || 0).toFixed(0)}</td>
                </tr>
              ))}
              {(data.historial || []).length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-slate-400 dark:text-slate-500">Sin ingresos registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data.pagos?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Receipt size={20} /> Historial de pagos</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  <th className="text-left py-2 px-2">Fecha</th>
                  <th className="text-left py-2 px-2">Concepto</th>
                  <th className="text-left py-2 px-2">Método</th>
                  <th className="text-right py-2 px-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.pagos.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-300">{new Date(p.fecha).toLocaleDateString("es-CO")}</td>
                    <td className="py-2 px-2 text-slate-800 dark:text-white font-medium">{p.concepto}</td>
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-300 capitalize">{p.metodo || "—"}</td>
                    <td className="py-2 px-2 text-right font-bold text-slate-800 dark:text-white">${p.valor.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.mensualidades?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Calendar size={20} /> Mensualidades</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  <th className="text-left py-2 px-2">Placa</th>
                  <th className="text-left py-2 px-2">Plan</th>
                  <th className="text-left py-2 px-2">Periodo</th>
                  <th className="text-left py-2 px-2">Estado</th>
                  <th className="text-right py-2 px-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.mensualidades.map((m, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="py-2 px-2 font-mono font-bold text-slate-800 dark:text-white">{m.placa}</td>
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-300">{m.plan?.nombre || "—"}</td>
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-300">{m.periodoInicio ? new Date(m.periodoInicio).toLocaleDateString("es-CO") : "—"} - {m.periodoFin ? new Date(m.periodoFin).toLocaleDateString("es-CO") : "—"}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.estado === "pagado" ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" :
                        m.estado === "vencido" ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400" :
                        "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                      }`}>{m.estado}</span>
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-slate-800 dark:text-white">${(m.valorPagado || m.valor || 0).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

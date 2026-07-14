import { useEffect, useState } from "react";
import { List, Search } from "lucide-react";
import useDebounce from "../hooks/useDebounce";
import api from "../services/api";
import Pagination from "../components/Pagination";
import Toast from "../components/Toast";
import ExportButton from "../components/ExportButton";

function IconActivity() {
  return <List className="w-4 h-4" />;
}

function IconSearch() {
  return <Search className="w-5 h-5 text-slate-400" />;
}

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const busquedaDebounced = useDebounce(busqueda);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const mostrarToast = (mensaje, tipo = "success") => setToast({ mensaje, tipo });

  const cargarMovimientos = async (p = 1) => {
    try {
      const params = { page: p };
      if (busqueda) params.q = busqueda;
      const res = await api.get("/movimientos", { params });
      setMovimientos(res.data.movimientos || []);
      setPagination(res.data.pagination || {});
    } catch { }
  };

  useEffect(() => { cargarMovimientos(page); }, [page]);
  useEffect(() => { cargarMovimientos(1); }, [busquedaDebounced]);

  return (
    <div className="min-h-screen bg-page dark:bg-slate-900 p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Movimientos</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Historial de auditoría del sistema — solo lectura</p>
        </div>
        <div className="flex gap-3">
          <ExportButton data={movimientos.map(m => ({ Fecha: new Date(m.createdAt).toLocaleString("es-CO"), Modulo: m.modulo, Accion: m.accion, Descripcion: m.descripcion || "", Usuario: m.usuario || "" }))} filename="movimientos" title="Movimientos" columns={[{ key: 'Fecha', label: 'Fecha' }, { key: 'Modulo', label: 'Módulo' }, { key: 'Accion', label: 'Acción' }, { key: 'Descripcion', label: 'Descripción' }, { key: 'Usuario', label: 'Usuario' }]} />
        </div>
      </div>

      <div className="p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 dark:bg-slate-800 mb-5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><IconSearch /></div>
          <input type="text" placeholder="Buscar por módulo, acción o descripción..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" />
        </div>
      </div>

      <div className="rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800 dark:bg-slate-700">
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Fecha</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Módulo</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Acción</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Descripción</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {movimientos.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-16 text-center"><p className="text-slate-400 dark:text-slate-500 text-sm">No hay movimientos registrados</p></td></tr>
              ) : (
                movimientos.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400">{new Date(m.createdAt).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h12" })}</td>
                    <td className="px-4 py-3.5"><span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border bg-teal-50 dark:bg-emerald-900/20 text-teal-700 dark:text-emerald-400 border-teal-200 dark:border-emerald-800 capitalize">{m.modulo}</span></td>
                    <td className="px-4 py-3.5"><span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 capitalize">{m.accion}</span></td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">{m.descripcion}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">{m.usuario || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={pagination.page || 1} totalPages={pagination.totalPages || 1} total={pagination.total || 0} onPageChange={setPage} />
      </div>

      <style>{`
        @keyframes modal-in { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-modal-in { animation: modal-in 0.25s ease-out; }
      `}</style>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
    </div>
  );
}

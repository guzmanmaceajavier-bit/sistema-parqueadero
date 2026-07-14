import { useState } from "react";
import api from "../services/api";
import Card from "../components/ui/Card";
import { useNotificaciones } from "../context/NotificacionContext";

export default function BackupPage() {
  const { limpiarNotificaciones } = useNotificaciones();
  const [backupData, setBackupData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [formatConfirm, setFormatConfirm] = useState("");
  const [formatLoading, setFormatLoading] = useState(false);

  const formatearSistema = async () => {
    if (formatConfirm !== "FORMATEAR") return;
    setFormatLoading(true);
    try {
      await api.post("/configuracion/formatear");
      limpiarNotificaciones();
      setResultados(["Sistema formateado correctamente — recargando..."]);
      setTimeout(() => window.location.href = "/", 2000);
    } catch { setResultados(["Error al formatear sistema"]); }
    finally { setFormatLoading(false); setFormatConfirm(""); }
  };

  const generarBackup = async () => {
    setLoading(true);
    setResultados(null);
    try {
      const res = await api.get("/backup");
      setBackupData(res.data.backup);
    } catch {} finally { setLoading(false); }
  };

  const descargarBackup = () => {
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restaurarBackup = async () => {
    if (!restoreFile) return;
    setLoading(true);
    setResultados(null);
    try {
      const text = await restoreFile.text();
      const backup = JSON.parse(text);
      const res = await api.post("/backup/restaurar", { data: backup.data });
      setResultados(res.data.resultados || []);
    } catch (e) {
      setResultados([`Error: ${e.message}`]);
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div>
        <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-widest">Sistema</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">Backup y Restauracion</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Generar Backup</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Exporta usuarios, clientes, vehiculos, puestos, tarifas, planes y configuracion.</p>
          <button onClick={generarBackup} disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-all disabled:opacity-50 cursor-pointer">
            {loading ? "Generando..." : "Generar Backup"}
          </button>
          {backupData && (
            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-sm text-emerald-700 dark:text-emerald-300">
                Backup generado: {new Date(backupData.fecha).toLocaleString("es-CO")}
              </div>
              <div className="flex gap-2">
                <button onClick={descargarBackup}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer">
                  Descargar JSON
                </button>
                <button onClick={() => setBackupData(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-all cursor-pointer">
                  Descartar
                </button>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Restaurar Backup</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Selecciona un archivo JSON de backup para restaurar.</p>
          <label className="block mb-3">
            <input type="file" accept=".json" onChange={(e) => setRestoreFile(e.target.files[0])}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 dark:file:bg-teal-900/30 dark:file:text-teal-300 cursor-pointer" />
          </label>
          <button onClick={restaurarBackup} disabled={!restoreFile || loading}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-all disabled:opacity-50 cursor-pointer">
            {loading ? "Restaurando..." : "Restaurar Backup"}
          </button>
          {resultados && (
            <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 max-h-40 overflow-y-auto">
              {resultados.map((r, i) => (
                <p key={i} className={`text-xs font-mono ${r.includes("ERROR") ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>{r}</p>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <div>
            <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Peligro</p>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Formatear Sistema</h3>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Elimina todos los datos del sistema: ingresos, facturas, mensualidades, reservas, ausencias, gastos, movimientos, caja, tarifas, planes, puestos, vehiculos y clientes. Solo se conservan los usuarios para poder iniciar sesion. <strong className="text-red-600">Esta accion no se puede deshacer.</strong></p>
        <div className="flex items-center gap-3">
          <input value={formatConfirm} onChange={e => setFormatConfirm(e.target.value)}
            className="w-44 px-3 py-2.5 border border-red-300 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200 placeholder:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-red-50 dark:bg-red-900/20"
            placeholder="Escribe FORMATEAR" />
          <button onClick={formatearSistema} disabled={formatConfirm !== "FORMATEAR" || formatLoading}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            {formatLoading ? "Formateando..." : "Formatear"}
          </button>
        </div>
      </Card>
    </div>
  );
}

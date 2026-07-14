import { useState } from "react";

export default function CajaAbrirModal({ open, onDone, abrirCaja }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!password) { setError("Ingrese su contraseña"); return; }
    setCargando(true);
    try {
      await abrirCaja({ apertura: 0, password });
      onDone(true);
      setPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Error al abrir la caja");
    } finally { setCargando(false); }
  };

  const handleCancel = () => {
    onDone(false);
    setPassword("");
    setError("");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCancel} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Caja cerrada</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Debe abrir la caja para continuar. Se abrirá automáticamente con $0.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">Contraseña</label>
            <input type="password" placeholder="Su contraseña" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white dark:bg-slate-700" autoFocus disabled={cargando} />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={handleCancel} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600">Cancelar</button>
            <button type="submit" disabled={cargando || !password} className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2">
              {cargando && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {cargando ? "Abriendo..." : "Abrir Caja"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

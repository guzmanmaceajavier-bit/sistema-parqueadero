import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({ abierto, titulo, mensaje, onConfirm, onCancel, confirmLabel = "Sí, continuar", cancelLabel = "Volver", tone = "danger", soloAceptar = false }) {
  if (!abierto) return null;

  const confirmStyle = tone === "warning"
    ? "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500"
    : tone === "primary"
    ? "bg-teal-600 hover:bg-teal-700 focus:ring-teal-500"
    : "bg-red-600 hover:bg-red-700 focus:ring-red-500";

  return (
    <div className="fixed inset-0 z-[60] flex justify-center items-center px-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message" className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 overflow-hidden p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <p id="confirm-dialog-title" className="text-lg font-bold text-slate-800 dark:text-white mb-2">{titulo}</p>
        <p id="confirm-dialog-message" className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 mb-6 whitespace-pre-line">{mensaje}</p>
        <div className="flex justify-center gap-3">
          {!soloAceptar && (
            <button onClick={onCancel} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-all active:scale-[0.98] cursor-pointer">{cancelLabel}</button>
          )}
          <button onClick={() => { onConfirm(); onCancel(); }} className={`px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-all active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmStyle}`}>{soloAceptar ? "Entendido" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

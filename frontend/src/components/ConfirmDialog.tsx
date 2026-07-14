import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({ abierto, titulo, mensaje, onConfirm, onCancel }) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-center items-center px-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <p className="text-lg font-bold text-slate-800 mb-2">{titulo}</p>
        <p className="text-sm text-slate-500 mb-6">{mensaje}</p>
        <div className="flex justify-center gap-3">
          <button onClick={onCancel} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all active:scale-[0.98] cursor-pointer">Cancelar</button>
          <button onClick={() => { onConfirm(); onCancel(); }} className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all active:scale-[0.98] cursor-pointer">Confirmar</button>
        </div>
      </div>
    </div>
  );
}

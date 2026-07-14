import { X } from "lucide-react";

export default function FormModal({ open, onClose, gradient, icon: Icon, titulo, subtitulo, children, footer, size = "max-w-md" }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-start pt-8 pb-8 px-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full ${size} border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[95vh] flex flex-col animate-modal-in`}>
        <div className={`relative bg-gradient-to-br ${gradient} px-6 pt-5 pb-12 shrink-0`}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white" />
            <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white" />
            <div className="absolute top-4 right-12 w-16 h-16 rounded-full bg-white" />
          </div>
          <button onClick={onClose} className="relative z-10 ml-auto block p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all">
            <X className="w-4 h-4" />
          </button>
          <div className="relative z-10 -mt-1 flex items-center gap-4">
            {Icon && (
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg shrink-0">
                <Icon className="w-6 h-6 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white drop-shadow-sm">{titulo}</h2>
              {subtitulo && <p className="text-xs text-white/80 mt-0.5">{subtitulo}</p>}
            </div>
          </div>
        </div>
        <div className="px-6 -mt-8 space-y-4 overflow-y-auto flex-1 pb-4 relative z-10">
          {children}
        </div>
        {footer && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

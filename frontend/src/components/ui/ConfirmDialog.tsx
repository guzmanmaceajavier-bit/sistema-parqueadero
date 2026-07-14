export default function ConfirmDialog({ abierto, titulo, mensaje, onConfirm, onCancel, confirmText = "Eliminar", danger = true }) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative rounded-2xl shadow-2xl p-6 w-80 mx-4 border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800">
        <h3 className="text-lg font-bold mb-2 text-slate-800 dark:text-white">{titulo}</h3>
        <p className="text-sm mb-6 text-slate-500 dark:text-slate-400">{mensaje}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
            Cancelar
          </button>
          <button onClick={() => { onConfirm(); onCancel(); }}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all cursor-pointer ${danger ? "bg-red-600 hover:bg-red-700" : "bg-teal-600 hover:bg-teal-700"}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

function IconX() {
  return <X className="w-4 h-4" />;
}

export default function Toast({ mensaje, tipo, onClose }) {
  useEffect(() => {
    if (mensaje) {
      const t = setTimeout(onClose, 3500);
      return () => clearTimeout(t);
    }
  }, [mensaje, onClose]);

  if (!mensaje) return null;

  const colores = tipo === "success" ? "bg-emerald-600" : tipo === "error" ? "bg-red-600" : "bg-slate-800";
  const icono = tipo === "success" ? (
    <CheckCircle className="w-5 h-5 flex-shrink-0" />
  ) : tipo === "error" ? (
    <XCircle className="w-5 h-5 flex-shrink-0" />
  ) : (
    <Info className="w-5 h-5 flex-shrink-0" />
  );

  return (
    <div className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-medium ${colores} flex items-center gap-3 animate-slide-up`}>
      {icono}
      <span>{mensaje}</span>
      <button onClick={onClose} className="p-1 hover:bg-white/20 rounded transition-colors ml-2"><IconX /></button>
    </div>
  );
}

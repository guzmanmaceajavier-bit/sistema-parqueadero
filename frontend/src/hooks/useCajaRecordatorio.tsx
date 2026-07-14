import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function useCajaRecordatorio(cajaAbierta: { apertura?: number; createdAt?: string } | null) {
  const [mostrar, setMostrar] = useState(false);
  const [horas, setHoras] = useState(0);

  useEffect(() => {
    if (!cajaAbierta?.createdAt) { setMostrar(false); return; }
    const check = () => {
      const diff = Date.now() - new Date(cajaAbierta.createdAt).getTime();
      const h = Math.floor(diff / 3600000);
      setHoras(h);
      setMostrar(h >= 12);
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [cajaAbierta?.createdAt]);

  const CajaRecordatorioBanner = mostrar ? (
    <div className="fixed bottom-20 right-4 z-50 bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-lg max-w-xs">
      <div className="flex items-start gap-3">
        <Clock size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Caja abierta hace {horas}h</p>
          <p className="text-xs text-amber-600 mt-0.5">Recuerda cerrar la caja al finalizar el turno</p>
        </div>
      </div>
    </div>
  ) : null;

  return { mostrar, horas, CajaRecordatorioBanner };
}

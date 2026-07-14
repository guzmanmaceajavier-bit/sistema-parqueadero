import { useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { useNotifications } from "../hooks/useNotifications";

export default function NotificacionesBanner() {
  const { permission, subscribed, requestPermission } = useNotifications();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || permission === "granted" || permission === "denied") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white rounded-2xl shadow-lg border border-slate-200 p-4 max-w-xs">
      <button onClick={() => setDismissed(true)} className="absolute top-2 right-2 text-slate-400 hover:text-slate-600">
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <Bell size={24} className="text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-slate-800">Notificaciones</p>
          <p className="text-xs text-slate-500 mt-0.5">Recibe alertas de vencimientos y ocupacion</p>
          <button onClick={requestPermission} className="mt-2 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
            Activar
          </button>
        </div>
      </div>
    </div>
  );
}

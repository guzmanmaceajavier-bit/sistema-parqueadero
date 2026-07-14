import { useState, useEffect, useCallback } from "react";
import { MessageCircle, X, Search, CheckSquare, Square, Send } from "lucide-react";
import api from "../services/api";
import Toast from "./Toast";

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";

export default function WhatsAppModal({ open, onClose, config }) {
  const [clientes, setClientes] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const mostrarToast = useCallback((mensaje, tipo = "success") => setToast({ mensaje, tipo }), []);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await api.get("/clientes", { params: { limit: 500 } });
        const todos = res.data.clientes || [];
        setClientes(todos.filter((c) => c.telefono));
      } catch { setClientes([]); }
    })();
  }, [open]);

  const filtrados = busqueda
    ? clientes.filter((c) => {
        const q = busqueda.toLowerCase();
        const nom = `${c.nombres || ""} ${c.apellidos || ""}`.toLowerCase();
        return nom.includes(q) || (c.documento || "").includes(q) || (c.telefono || "").includes(q);
      })
    : clientes;

  const toggleAll = () => {
    if (selectedIds.size === filtrados.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtrados.map((c) => c.id)));
    }
  };

  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const parqueadero = config?.nombreParqueadero || "ParkAdmin";
  const defaultMsg = `Buenos días, te informamos que ${parqueadero} estará realizando mantenimiento programado. Agradecemos tu comprensión.`;

  const enviar = () => {
    if (selectedIds.size === 0) { mostrarToast("Selecciona al menos un cliente", "error"); return; }
    if (!mensaje.trim()) { mostrarToast("Escribe un mensaje", "error"); return; }
    setEnviando(true);
    const msg = mensaje.trim();
    let enviados = 0;
    clientes.filter((c) => selectedIds.has(c.id)).forEach((c) => {
      const tel = c.telefono.replace(/[^0-9]/g, "");
      const numero = tel.startsWith("57") ? tel : `57${tel}`;
      const personalizado = msg
        .replace(/{nombre}/g, `${c.nombres || ""} ${c.apellidos || ""}`.trim())
        .replace(/{documento}/g, c.documento || "")
        .replace(/{telefono}/g, c.telefono || "");
      window.open(`https://wa.me/${numero}?text=${encodeURIComponent(personalizado)}`, "_blank");
      enviados++;
    });
    setTimeout(() => {
      setEnviando(false);
      mostrarToast(`WhatsApp abierto para ${enviados} cliente(s)`, "success");
    }, 500);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700 animate-modal-in overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-500 px-5 pt-5 pb-6 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">WhatsApp Masivo</h2>
                <p className="text-xs text-white/80">{clientes.length} clientes con teléfono</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar cliente por nombre, documento o teléfono..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={`${inputClass} pl-10`} />
          </div>

          <div className="flex items-center justify-between text-sm">
            <button onClick={toggleAll} className="inline-flex items-center gap-1.5 text-teal-600 dark:text-teal-400 hover:text-teal-700 font-medium cursor-pointer">
              {selectedIds.size === filtrados.length && filtrados.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {selectedIds.size === filtrados.length ? "Deseleccionar todos" : "Seleccionar todos"}
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500">{selectedIds.size} de {filtrados.length} seleccionados</span>
          </div>

          <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg divide-y divide-slate-100 dark:divide-slate-700">
            {filtrados.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No se encontraron clientes con teléfono</div>
            ) : filtrados.map((c) => (
              <div key={c.id} onClick={() => toggleOne(c.id)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleOne(c.id)} className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/20 cursor-pointer" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{c.nombres} {c.apellidos}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{c.documento} · {c.telefono}</p>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className={labelClass}>Mensaje personalizado</label>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Usa {'{nombre}'}, {'{documento}'}, {'{telefono}'} para personalizar</p>
            <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={5}
              className={`${inputClass} resize-none`} placeholder={defaultMsg} />
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer">Cancelar</button>
          <button onClick={enviar} disabled={enviando || selectedIds.size === 0 || !mensaje.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">
            <Send className="w-4 h-4" /> {enviando ? "Procesando..." : `Enviar a ${selectedIds.size} cliente(s)`}
          </button>
        </div>
      </div>
      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
    </div>
  );
}

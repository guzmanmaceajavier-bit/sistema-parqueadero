import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Phone, Mail, Car } from "lucide-react";
import api from "../services/api";

let cache = {};
let cacheTimer = {};

export default function ClientSearch({ value, onChange, placeholder = "Buscar cliente...", disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const ref = useRef(null);
  const fetchedRef = useRef({});

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!value) { setLabel(""); return; }
    const id = Number(value);
    if (!id) return;
    if (fetchedRef.current[id]) { setLabel(fetchedRef.current[id]); return; }
    api.get(`/clientes/${id}`).then(res => {
      const c = res.data.cliente;
      if (c) fetchedRef.current[c.id] = `${c.nombres} ${c.apellidos}`;
      if (fetchedRef.current[id]) setLabel(fetchedRef.current[id]);
    }).catch(() => {});
  }, [value]);

  const search = useCallback(async (query) => {
    if (!query || query.length < 1) { setResults([]); return; }
    const key = query.toLowerCase();
    if (cache[key] && Date.now() - (cacheTimer[key] || 0) < 30000) {
      setResults(cache[key]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/clientes?q=${encodeURIComponent(query)}&limit=10`);
      const data = res.data.clientes || [];
      data.forEach(c => { fetchedRef.current[c.id] = `${c.nombres} ${c.apellidos}`; });
      cache[key] = data;
      cacheTimer[key] = Date.now();
      setResults(data);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!open || !q || q.length < 1) { setResults([]); return; }
    const timer = setTimeout(() => search(q), 200);
    return () => clearTimeout(timer);
  }, [q, open, search]);

  const handleSelect = (cliente) => {
    setLabel(`${cliente.nombres} ${cliente.apellidos}`);
    onChange(cliente.id);
    setOpen(false);
    setQ("");
  };

  const inputClass = "w-full px-3 py-2.5 pl-10 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";

  return (
    <div className="relative" ref={ref}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
      <input
        value={open ? q : label}
        onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) { onChange(null); setLabel(""); } }}
        onFocus={() => { setOpen(true); if (!label) setQ(""); }}
        placeholder={placeholder}
        className={inputClass}
        autoComplete="off"
        disabled={disabled}
      />
      {loading && open && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1.5 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl max-h-72 overflow-y-auto">
          {results.map((c, i) => (
            <button key={c.id} type="button" onClick={() => handleSelect(c)}
              className={`w-full text-left px-4 py-3 transition-colors ${i < results.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''} ${value == c.id ? "bg-teal-50 dark:bg-teal-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-slate-800 dark:text-white truncate">{c.nombres} {c.apellidos}</span>
                {c.documento && (
                  <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{c.documento}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                {c.telefono && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                    <Phone className="w-3 h-3" /> {c.telefono}
                  </span>
                )}
                {c.email && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
                    <Mail className="w-3 h-3 shrink-0" /> {c.email}
                  </span>
                )}
              </div>
              {c.vehiculos && c.vehiculos.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {c.vehiculos.map(v => (
                    <span key={v.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-700/50">
                      <Car className="w-2.5 h-2.5" />
                      {v.placa}
                      {v.marca && <span className="text-slate-400 dark:text-slate-500 font-normal">· {v.marca}</span>}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {open && q.length >= 1 && results.length === 0 && !loading && (
        <div className="absolute z-50 mt-1.5 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl p-5 text-center">
          <p className="text-sm text-slate-400 dark:text-slate-500">No se encontraron clientes</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Busca por nombre, documento, teléfono o placa</p>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";

const btnClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-left bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 cursor-pointer flex items-center justify-between gap-2";

export default function SelectWithOther({ options, value, onChange, name, placeholder, label, className = inputClass, otherLabel = "Otro" }) {
  const [esOtro, setEsOtro] = useState(value && !options.find(o => o.value === value));
  const [otroValor, setOtroValor] = useState(esOtro ? value : "");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef(null);
  const listRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    return () => close();
  }, [close]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target) && listRef.current && !listRef.current.contains(e.target)) close();
    };
    const scrollHandler = (e) => {
      if (listRef.current && !listRef.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("scroll", scrollHandler, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("scroll", scrollHandler, true);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const h = Math.min(192, (options.length + 1) * 40 + 8);
    const espacioAbajo = window.innerHeight - rect.bottom - 8;
    if (espacioAbajo >= h) {
      setPos({ top: rect.bottom, left: rect.left, width: rect.width });
    } else {
      setPos({ top: rect.top - h, left: rect.left, width: rect.width });
    }
  }, [open, options.length]);

  const selected = options.find(o => o.value === value);

  const handleSelect = (val) => {
    setOpen(false);
    if (val === "__other__") {
      setEsOtro(true);
      onChange({ target: { name, value: otroValor || "" } });
    } else {
      setEsOtro(false);
      onChange({ target: { name, value: val } });
    }
  };

  const handleOtherInput = (e) => {
    setOtroValor(e.target.value);
    onChange({ target: { name, value: e.target.value } });
  };

  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">{label}</label>}
      {!esOtro ? (
        <div className="relative">
          <button ref={btnRef} type="button" onClick={() => setOpen(!open)} className={btnClass}>
            <span className="truncate text-slate-800 dark:text-white">{selected ? selected.label : placeholder || "Seleccionar..."}</span>
            <svg className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {open && (
            <div
              ref={listRef}
              className="fixed z-[100] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl overflow-y-auto"
              style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: 192 }}
            >
              {options.map(o => (
                <button key={o.value} type="button" onMouseDown={() => handleSelect(o.value)} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer ${value === o.value ? "bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 font-medium" : "text-slate-700 dark:text-slate-300"}`}>
                  {o.label}
                </button>
              ))}
              <button type="button" onMouseDown={() => handleSelect("__other__")} className="w-full text-left px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors border-t border-slate-100 dark:border-slate-600 cursor-pointer italic">
                {`${otherLabel}...`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <input type="text" value={otroValor} onChange={handleOtherInput} placeholder="Especificar..." className={className} autoFocus />
          <button type="button" onClick={() => { setEsOtro(false); setOtroValor(""); onChange({ target: { name, value: "" } }); }} className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors cursor-pointer">
            Volver
          </button>
        </div>
      )}
    </div>
  );
}

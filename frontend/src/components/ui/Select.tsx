import { useState, useRef, useEffect, useCallback } from "react";

const btnClass = "w-full border border-slate-200 dark:border-slate-600 rounded-lg text-left bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
const sizeClass = { sm: "px-2 py-1 text-xs", md: "px-3 py-2.5 text-sm" };
const optionClass = { sm: "px-2 py-1.5 text-xs", md: "px-3 py-2 text-sm" };

export default function Select({ options, value, onChange, placeholder = "Seleccionar...", className = "", disabled = false, size = "md" }) {
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
    const espacioAbajo = window.innerHeight - rect.bottom - 8;
    const h = Math.min(192, options.length * 40 + 8);
    if (espacioAbajo >= h) {
      setPos({ top: rect.bottom, left: rect.left, width: rect.width });
    } else {
      setPos({ top: rect.top - h, left: rect.left, width: rect.width });
    }
  }, [open, options.length]);

  const selected = options.find(o => String(o.value) === String(value));

  return (
    <div className={`relative ${className}`}>
      <button ref={btnRef} type="button" disabled={disabled} onClick={() => setOpen(!open)} className={`${btnClass} ${sizeClass[size]}`}>
        <span className="truncate text-slate-800 dark:text-white">
          {selected && value !== "" && value !== null && value !== undefined ? selected.label : placeholder}
        </span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div
          ref={listRef}
          className="fixed z-[100] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl overflow-y-auto"
          style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: 192 }}
        >
          {options.map((o, i) => (
            <button key={o.value ?? i} type="button" onMouseDown={() => { onChange(o.value); setOpen(false); }} className={`w-full text-left ${optionClass[size]} hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer ${String(o.value) === String(value) ? "bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 font-medium" : "text-slate-700 dark:text-slate-300"}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

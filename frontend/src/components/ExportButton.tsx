import { useState, useRef, useEffect } from "react";
import { exportToCsv, exportToExcel, exportToPdf } from "../utils/exportData";
import { Download, ChevronDown } from "lucide-react";

export default function ExportButton({ data, filename = "export", columns, title = "Reporte" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const disabled = !data || data.length === 0;

  const opts = [
    { label: "Excel (XLSX)", icon: "📊", fn: () => exportToExcel(data, filename, columns) },
    { label: "PDF", icon: "📄", fn: () => exportToPdf(data, filename, columns, title) },
    { label: "CSV", icon: "📝", fn: () => exportToCsv(data, filename, columns) },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4" />
        Exportar
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {opts.map((o) => (
            <button
              key={o.label}
              onClick={() => { o.fn(); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              <span>{o.icon}</span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

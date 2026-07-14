import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, totalPages, total, onPageChange }) {
  const btnClass = "px-3 py-1.5 text-sm rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  const pages = [];
  if (totalPages > 1) {
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-white rounded-b-xl">
      <span className="text-sm text-slate-500">
        {total > 0 ? `Página ${page} de ${totalPages} (${total} registros)` : "Sin registros"}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button onClick={() => onPageChange(1)} disabled={page === 1} className={`${btnClass} text-slate-500 hover:bg-slate-100`} title="Primera página">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className={`${btnClass} text-slate-500 hover:bg-slate-100`}>Anterior</button>
          {pages.map(p => (
            <button key={p} onClick={() => onPageChange(p)} className={`${btnClass} ${p === page ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>{p}</button>
          ))}
          <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages} className={`${btnClass} text-slate-500 hover:bg-slate-100`}>Siguiente</button>
          <button onClick={() => onPageChange(totalPages)} disabled={page === totalPages} className={`${btnClass} text-slate-500 hover:bg-slate-100`} title="Última página">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

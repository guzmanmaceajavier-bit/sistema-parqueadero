import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export default function Pagination({ page, totalPages, total, onPageChange }) {
  const navBtn = "inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const textBtn = "px-3 py-1.5 text-sm rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hidden sm:inline-flex";

  const pages = [];
  if (totalPages > 1) {
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-b-xl">
      <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">
        {total > 0 ? `Página ${page} de ${totalPages} · ${total} registros` : "Sin registros"}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button onClick={() => onPageChange(1)} disabled={page === 1} className={navBtn} title="Primera página" aria-label="Primera página">
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className={navBtn} aria-label="Anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className={textBtn}>Anterior</span>
          {pages.map(p => (
            <button key={p} onClick={() => onPageChange(p)} aria-label={`Página ${p}`}
              className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm transition-colors ${p === page ? "bg-teal-600 text-white shadow-sm font-semibold" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
              {p}
            </button>
          ))}
          <span className={textBtn}>Siguiente</span>
          <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages} className={navBtn} aria-label="Siguiente">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => onPageChange(totalPages)} disabled={page === totalPages} className={navBtn} title="Última página" aria-label="Última página">
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

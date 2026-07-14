import { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  keyExtractor: (item: T) => string | number;
}

export default function Table<T extends Record<string, unknown>>({ columns, data, loading, emptyMessage = "Sin registros", keyExtractor }: TableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-3 p-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse dark:bg-slate-700" />
        ))}
      </div>
    );
  }

  if (!data.length) {
    return <div className="text-center py-12 text-slate-400 text-sm">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-700">
            {columns.map((col) => (
              <th key={col.key} className={`text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${col.className || ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
          {data.map((item) => (
            <tr key={keyExtractor(item)} className="hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-700/30">
              {columns.map((col) => (
                <td key={col.key} className={`py-3 px-3 text-sm text-slate-700 dark:text-slate-300 ${col.className || ""}`}>
                  {col.render ? col.render(item) : String(item[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, totalPages, total, onPageChange }: {
  page: number; totalPages: number; total: number; onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-3 border-t border-slate-100 dark:border-slate-700">
      <span className="text-xs text-slate-400">{total} registros</span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-slate-700">
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs text-slate-500 px-2">{page} / {totalPages || 1}</span>
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-slate-700">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

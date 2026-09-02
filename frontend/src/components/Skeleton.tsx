export function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-12 bg-slate-200 dark:bg-slate-600 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-600 rounded" /></td>
      <td className="px-4 py-3 hidden sm:table-cell"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-600 rounded" /></td>
      <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-28 bg-slate-200 dark:bg-slate-600 rounded" /></td>
      <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-600 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 bg-slate-200 dark:bg-slate-600 rounded" /></td>
    </tr>
  );
}

export function TableSkeleton({ rows = 8, cols = 6 }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-9 w-64 bg-slate-200 dark:bg-slate-600 rounded-lg" />
          <div className="h-9 w-24 bg-slate-200 dark:bg-slate-600 rounded-lg" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-600 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-600 rounded" />
            <div className="h-9 w-9 rounded-lg bg-slate-200 dark:bg-slate-600" />
          </div>
          <div className="h-7 w-24 bg-slate-200 dark:bg-slate-600 rounded mb-2" />
          <div className="h-3 w-32 bg-slate-200 dark:bg-slate-600 rounded" />
        </div>
      ))}
    </div>
  );
}

export function PuestosGridSkeleton({ count = 12 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-3 shadow-sm animate-pulse">
          <div className="h-4 w-16 bg-slate-200 dark:bg-slate-600 rounded mb-2" />
          <div className="h-3 w-12 bg-slate-200 dark:bg-slate-600 rounded mb-3" />
          <div className="h-8 w-full bg-slate-200 dark:bg-slate-600 rounded" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="h-8 w-40 bg-slate-200 dark:bg-slate-600 rounded mb-2 animate-pulse" />
          <div className="h-4 w-56 bg-slate-200 dark:bg-slate-600 rounded animate-pulse" />
        </div>
        <div className="h-9 w-32 bg-slate-200 dark:bg-slate-600 rounded-lg animate-pulse" />
      </div>
      <TableSkeleton />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="h-8 w-40 bg-slate-200 dark:bg-slate-600 rounded mb-2" />
          <div className="h-4 w-56 bg-slate-200 dark:bg-slate-600 rounded" />
        </div>
        <div className="h-8 w-32 bg-slate-200 dark:bg-slate-600 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 shadow-sm animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-600 rounded" />
              <div className="h-9 w-9 rounded-lg bg-slate-200 dark:bg-slate-600" />
            </div>
            <div className="h-7 w-24 bg-slate-200 dark:bg-slate-600 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm animate-pulse">
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-600 rounded mb-6" />
          <div className="h-48 bg-slate-100 dark:bg-slate-700 rounded-lg" />
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm animate-pulse">
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-600 rounded mb-6" />
          <div className="h-48 bg-slate-100 dark:bg-slate-700 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

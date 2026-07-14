function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-20 bg-slate-200 rounded" />
        <div className="h-9 w-9 rounded-lg bg-slate-200" />
      </div>
      <div className="h-7 w-24 bg-slate-200 rounded" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm animate-pulse">
      <div className="h-4 w-24 bg-slate-200 rounded mb-2" />
      <div className="h-3 w-32 bg-slate-200 rounded mb-6" />
      <div className="h-48 bg-slate-100 rounded-lg" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="h-8 w-40 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-56 bg-slate-200 rounded" />
        </div>
        <div className="h-8 w-32 bg-slate-200 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  );
}

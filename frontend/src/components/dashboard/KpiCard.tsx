import { useNavigate } from "react-router-dom";

interface KpiCardProps {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  route: string;
  badge?: string;
}

const bgMap: Record<string, string> = {
  emerald: "bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-600",
  blue: "bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600",
  amber: "bg-amber-600 dark:bg-amber-700 hover:bg-amber-700 dark:hover:bg-amber-600",
  teal: "bg-teal-600 dark:bg-teal-700 hover:bg-teal-700 dark:hover:bg-teal-600",
  red: "bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600",
  slate: "bg-slate-500 dark:bg-slate-600 hover:bg-slate-600 dark:hover:bg-slate-500",
};

export default function KpiCard({ label, value, subtitle, icon: Icon, bg, route }: KpiCardProps) {
  const navigate = useNavigate();
  const c = bgMap[bg] || bgMap.slate;
  return (
    <div onClick={() => navigate(route)}
      className={`relative rounded-xl shadow-sm overflow-hidden transition-all duration-200 cursor-pointer active:scale-[0.98] ${c}`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">{label}</span>
          <div className="p-2 rounded-lg bg-white/15">
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-white/70">{subtitle}</span>
        </div>
      </div>
    </div>
  );
}

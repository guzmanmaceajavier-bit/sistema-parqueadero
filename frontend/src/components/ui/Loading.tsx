export default function Loading({ texto = "Cargando..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-sm font-medium">{texto}</p>
    </div>
  );
}

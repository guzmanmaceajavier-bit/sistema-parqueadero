export interface PeriodoReporte {
  inicio: Date;
  finExclusivo: Date;
}

function parseFechaLocal(value: unknown, campo: string): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError(`La fecha ${campo} debe tener formato YYYY-MM-DD`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const fecha = new Date(year, month - 1, day);
  if (fecha.getFullYear() !== year || fecha.getMonth() !== month - 1 || fecha.getDate() !== day) {
    throw new RangeError(`La fecha ${campo} no es válida`);
  }
  return fecha;
}

export function obtenerPeriodoReporte(
  fechaInicio?: unknown,
  fechaFin?: unknown,
  ahora = new Date(),
): PeriodoReporte {
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const inicio = fechaInicio === undefined ? hoy : parseFechaLocal(fechaInicio, "inicial");
  const fin = fechaFin === undefined ? hoy : parseFechaLocal(fechaFin, "final");

  if (inicio.getTime() > fin.getTime()) {
    throw new RangeError("La fecha inicial no puede ser posterior a la fecha final");
  }

  return {
    inicio,
    finExclusivo: new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() + 1),
  };
}

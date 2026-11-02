export interface PeriodoReporte {
  inicio: Date;
  finExclusivo: Date;
}

interface FechaCalendario {
  year: number;
  month: number;
  day: number;
}

interface FechaHoraCalendario extends FechaCalendario {
  hour: number;
  minute: number;
  second: number;
}

function partesFechaHoraEnZona(fecha: Date, timeZone: string): FechaHoraCalendario {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const valores = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return {
    year: Number(valores.year),
    month: Number(valores.month),
    day: Number(valores.day),
    hour: Number(valores.hour),
    minute: Number(valores.minute),
    second: Number(valores.second),
  };
}

function partesFechaEnZona(fecha: Date, timeZone: string): FechaCalendario {
  const { year, month, day } = partesFechaHoraEnZona(fecha, timeZone);
  return { year, month, day };
}

export function obtenerFechaClaveEnZona(fecha: Date, timeZone: string): string {
  const partes = partesFechaEnZona(fecha, timeZone);
  return `${partes.year}-${String(partes.month).padStart(2, "0")}-${String(partes.day).padStart(2, "0")}`;
}

function parseFechaCalendario(value: unknown, campo: string): FechaCalendario {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError(`La fecha ${campo} debe tener formato YYYY-MM-DD`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const comprobacion = new Date(0);
  comprobacion.setUTCHours(0, 0, 0, 0);
  comprobacion.setUTCFullYear(year, month - 1, day);
  if (
    comprobacion.getUTCFullYear() !== year ||
    comprobacion.getUTCMonth() !== month - 1 ||
    comprobacion.getUTCDate() !== day
  ) {
    throw new RangeError(`La fecha ${campo} no es válida`);
  }
  return { year, month, day };
}

function inicioDiaEnZona(fecha: FechaCalendario, timeZone: string): Date {
  const objetivo = Date.UTC(fecha.year, fecha.month - 1, fecha.day);
  let instante = objetivo;

  // Corrige la diferencia entre la hora UTC candidata y la medianoche de la zona configurada.
  for (let intento = 0; intento < 4; intento++) {
    const representada = partesFechaHoraEnZona(new Date(instante), timeZone);
    const instanteRepresentado = Date.UTC(
      representada.year,
      representada.month - 1,
      representada.day,
      representada.hour,
      representada.minute,
      representada.second,
    );
    const diferencia = objetivo - instanteRepresentado;
    if (diferencia === 0) break;
    instante += diferencia;
  }

  return new Date(instante);
}

export function obtenerPeriodoReporte(
  fechaInicio?: unknown,
  fechaFin?: unknown,
  ahora = new Date(),
  timeZone = "America/Bogota",
): PeriodoReporte {
  const hoy = partesFechaEnZona(ahora, timeZone);
  const inicioCalendario = fechaInicio === undefined
    ? hoy
    : parseFechaCalendario(fechaInicio, "inicial");
  const finCalendario = fechaFin === undefined
    ? hoy
    : parseFechaCalendario(fechaFin, "final");

  const inicioOrden = Date.UTC(inicioCalendario.year, inicioCalendario.month - 1, inicioCalendario.day);
  const finOrden = Date.UTC(finCalendario.year, finCalendario.month - 1, finCalendario.day);
  if (inicioOrden > finOrden) {
    throw new RangeError("La fecha inicial no puede ser posterior a la fecha final");
  }

  const diaSiguiente = new Date(Date.UTC(
    finCalendario.year,
    finCalendario.month - 1,
    finCalendario.day + 1,
  ));

  return {
    inicio: inicioDiaEnZona(inicioCalendario, timeZone),
    finExclusivo: inicioDiaEnZona({
      year: diaSiguiente.getUTCFullYear(),
      month: diaSiguiente.getUTCMonth() + 1,
      day: diaSiguiente.getUTCDate(),
    }, timeZone),
  };
}

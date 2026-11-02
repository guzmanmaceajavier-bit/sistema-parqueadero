export function sumarMesesConTope(fecha: Date, meses: number): Date {
  if (!Number.isFinite(fecha.getTime()) || !Number.isInteger(meses)) {
    throw new RangeError("La fecha y la cantidad de meses deben ser válidas");
  }
  const resultado = new Date(fecha);
  const diaOriginal = resultado.getDate();
  resultado.setDate(1);
  resultado.setMonth(resultado.getMonth() + meses);
  const ultimoDia = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
  resultado.setDate(Math.min(diaOriginal, ultimoDia));
  return resultado;
}

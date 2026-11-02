export function sumarMesesConTope(fecha: Date, meses: number): Date {
  if (!Number.isFinite(fecha.getTime()) || !Number.isInteger(meses)) {
    throw new RangeError("La fecha y la cantidad de meses deben ser válidas");
  }
  const resultado = new Date(fecha);
  const diaOriginal = resultado.getUTCDate();
  const ultimoDiaOrigen = new Date(Date.UTC(resultado.getUTCFullYear(), resultado.getUTCMonth() + 1, 0)).getUTCDate();
  const esFinDeMes = diaOriginal === ultimoDiaOrigen;
  resultado.setUTCDate(1);
  resultado.setUTCMonth(resultado.getUTCMonth() + meses);
  const ultimoDiaDestino = new Date(Date.UTC(resultado.getUTCFullYear(), resultado.getUTCMonth() + 1, 0)).getUTCDate();
  resultado.setUTCDate(esFinDeMes ? ultimoDiaDestino : Math.min(diaOriginal, ultimoDiaDestino));
  return resultado;
}

export function sumarMesesConTope(fecha: Date, meses: number): Date {
  if (!Number.isFinite(fecha.getTime()) || !Number.isInteger(meses)) {
    throw new RangeError("La fecha y la cantidad de meses deben ser válidas");
  }
  const resultado = new Date(fecha);
  const diaOriginal = resultado.getDate();
  const ultimoDiaOrigen = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
  const esFinDeMes = diaOriginal === ultimoDiaOrigen;
  resultado.setDate(1);
  resultado.setMonth(resultado.getMonth() + meses);
  const ultimoDiaDestino = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
  resultado.setDate(esFinDeMes ? ultimoDiaDestino : Math.min(diaOriginal, ultimoDiaDestino));
  return resultado;
}

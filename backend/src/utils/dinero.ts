/** Operaciones monetarias en centavos para evitar acumulación de errores binarios de Float. */
export function aCentavos(valor: number): number {
  if (!Number.isFinite(valor)) throw new RangeError("El importe debe ser un número finito");
  return Math.round((valor + Math.sign(valor) * Number.EPSILON) * 100);
}

export function desdeCentavos(valor: number): number {
  if (!Number.isSafeInteger(valor)) throw new RangeError("El importe excede el rango monetario seguro");
  return valor / 100;
}

export function redondearDinero(valor: number): number {
  return desdeCentavos(aCentavos(valor));
}

export function sumarDinero(...valores: number[]): number {
  return desdeCentavos(valores.reduce((total, valor) => total + aCentavos(valor), 0));
}

export function restarDinero(minuendo: number, sustraendo: number): number {
  return desdeCentavos(aCentavos(minuendo) - aCentavos(sustraendo));
}

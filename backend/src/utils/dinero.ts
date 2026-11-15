/** Operaciones monetarias en centavos para evitar acumulación de errores binarios de Float. */
export function aCentavos(valor: number): number {
  if (!Number.isFinite(valor)) throw new RangeError("El importe debe ser un número finito");
  const centavos = Math.round((valor + Math.sign(valor) * Number.EPSILON) * 100);
  if (!Number.isSafeInteger(centavos)) throw new RangeError("El importe excede el rango monetario seguro");
  return centavos;
}

export function desdeCentavos(valor: number): number {
  if (!Number.isSafeInteger(valor)) throw new RangeError("El importe excede el rango monetario seguro");
  return valor / 100;
}

export function redondearDinero(valor: number): number {
  return desdeCentavos(aCentavos(valor));
}

/**
 * Normaliza importes recibidos desde formularios/API.
 * Devuelve null para entradas vacías, no numéricas, infinitas o fuera del rango seguro.
 * No interpreta separadores de miles: la API debe recibir números o decimales estándar.
 */
export function normalizarMonto(valor: unknown): number | null {
  if (typeof valor !== "number" && typeof valor !== "string") return null;
  if (typeof valor === "string" && valor.trim() === "") return null;
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(numero)) return null;
  try {
    return redondearDinero(numero);
  } catch {
    return null;
  }
}

export function sumarDinero(...valores: number[]): number {
  return desdeCentavos(valores.reduce((total, valor) => total + aCentavos(valor), 0));
}

export function restarDinero(minuendo: number, sustraendo: number): number {
  return desdeCentavos(aCentavos(minuendo) - aCentavos(sustraendo));
}

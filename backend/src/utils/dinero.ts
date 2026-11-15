/** Operaciones monetarias en centavos; acepta números, strings y Prisma.Decimal. */
export type Importe = number | string | { toNumber(): number };

function aNumero(valor: Importe): number {
  const numero = typeof valor === "number"
    ? valor
    : typeof valor === "string"
      ? Number(valor)
      : valor.toNumber();
  if (!Number.isFinite(numero)) throw new RangeError("El importe debe ser un número finito");
  return numero;
}

export function aCentavos(valor: Importe): number {
  const numero = aNumero(valor);
  const centavos = Math.round((numero + Math.sign(numero) * Number.EPSILON) * 100);
  if (!Number.isSafeInteger(centavos)) throw new RangeError("El importe excede el rango monetario seguro");
  return centavos;
}

export function desdeCentavos(valor: number): number {
  if (!Number.isSafeInteger(valor)) throw new RangeError("El importe excede el rango monetario seguro");
  return valor / 100;
}

export function redondearDinero(valor: Importe): number {
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

export function sumarDinero(...valores: Importe[]): number {
  return desdeCentavos(valores.reduce<number>((total, valor) => total + aCentavos(valor), 0));
}

export function restarDinero(minuendo: Importe, sustraendo: Importe): number {
  return desdeCentavos(aCentavos(minuendo) - aCentavos(sustraendo));
}

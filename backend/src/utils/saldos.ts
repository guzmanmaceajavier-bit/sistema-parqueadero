export interface FacturaMensualidad {
  createdAt: Date;
  valor: number;
  metodoPago: string | null;
}

export function calcularPagadoMensualidad(
  facturas: FacturaMensualidad[],
  fechaInicio: Date,
): number {
  const inicio = fechaInicio.getTime();
  if (!Number.isFinite(inicio)) throw new RangeError("La fecha de inicio de la mensualidad no es válida");
  return facturas
    .filter((factura) => factura.metodoPago !== null && factura.createdAt.getTime() >= inicio)
    .reduce((total, factura) => total + factura.valor, 0);
}

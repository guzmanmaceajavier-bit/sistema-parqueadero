import prisma from "../../config/prisma.js";

export async function calcularTotalesHelper(cajaId: number, db: { cajaMovimiento: typeof prisma.cajaMovimiento } = prisma) {
  const movs = await db.cajaMovimiento.findMany({
    where: { cajaId, anulado: false },
    select: { monto: true, tipo: true, metodoPago: true },
  });

  let totalIngresos = 0;
  let totalEgresos = 0;
  let egresosEfectivo = 0;
  const porMetodo: Record<string, number> = { efectivo: 0, tarjeta: 0, transferencia: 0, otros: 0 };

  for (const m of movs) {
    if (m.tipo === "INGRESO") {
      totalIngresos += m.monto;
      const metodo = m.metodoPago || "otros";
      if (porMetodo[metodo] !== undefined) porMetodo[metodo] += m.monto;
      else porMetodo.otros += m.monto;
    } else if (m.tipo === "EGRESO") {
      totalEgresos += m.monto;
      if ((m.metodoPago || "efectivo") === "efectivo") egresosEfectivo += m.monto;
    }
  }

  return {
    ingresos: totalIngresos,
    ingresosEfectivo: porMetodo.efectivo,
    ingresosTarjeta: porMetodo.tarjeta,
    ingresosTransferencia: porMetodo.transferencia,
    ingresosOtros: porMetodo.otros,
    egresos: totalEgresos,
    egresosEfectivo,
    efectivoIngresado: porMetodo.efectivo,
  };
}

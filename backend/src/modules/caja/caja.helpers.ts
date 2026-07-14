import prisma from "../../config/prisma.js";

export async function calcularTotalesHelper(cajaId) {
  const movs = await prisma.cajaMovimiento.findMany({
    where: { cajaId },
    select: { monto: true, tipo: true, metodoPago: true },
  });

  let totalIngresos = 0;
  let totalEgresos = 0;
  const porMetodo = { efectivo: 0, tarjeta: 0, transferencia: 0, otros: 0 };

  for (const m of movs) {
    if (m.tipo === "INGRESO") {
      totalIngresos += m.monto;
      const metodo = m.metodoPago || "otros";
      if (porMetodo[metodo] !== undefined) porMetodo[metodo] += m.monto;
      else porMetodo.otros += m.monto;
    } else if (m.tipo === "EGRESO") {
      totalEgresos += m.monto;
    }
  }

  return {
    ingresos: totalIngresos,
    ingresosEfectivo: porMetodo.efectivo,
    ingresosTarjeta: porMetodo.tarjeta,
    ingresosTransferencia: porMetodo.transferencia,
    ingresosOtros: porMetodo.otros,
    egresos: totalEgresos,
    efectivoIngresado: porMetodo.efectivo,
  };
}

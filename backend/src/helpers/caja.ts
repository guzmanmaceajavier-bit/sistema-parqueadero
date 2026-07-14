import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";

export async function getCajaAbierta() {
  const caja = await prisma.caja.findFirst({
    where: { estado: "ABIERTA" },
    include: { usuario: { select: { id: true, nombre: true, usuario: true } } },
  });
  if (!caja) return null;
  const { ingresos, egresos } = await calcularTotales(caja.id);
  return { ...caja, ingresos, egresos, saldo: caja.apertura + ingresos - egresos };
}

export async function getCajaOError() {
  const caja = await getCajaAbierta();
  if (!caja) throw new AppError("Caja cerrada", 400);
  return caja;
}

async function calcularTotales(cajaId) {
  const [ingresos, egresos] = await Promise.all([
    prisma.cajaMovimiento.aggregate({
      _sum: { monto: true },
      where: { cajaId, tipo: "INGRESO" },
    }),
    prisma.cajaMovimiento.aggregate({
      _sum: { monto: true },
      where: { cajaId, tipo: "EGRESO" },
    }),
  ]);
  return {
    ingresos: ingresos._sum.monto || 0,
    egresos: egresos._sum.monto || 0,
  };
}

import prisma from "../../config/prisma.js";
import type { Prisma } from "@prisma/client";
import { paginate } from "../../utils/pagination.js";

export const crearIngreso = (data: Prisma.IngresoUncheckedCreateInput, include?: Prisma.IngresoInclude) =>
  prisma.ingreso.create({ data, include });
export const obtenerIngresosPaginado = (params: Parameters<typeof paginate>[2]) =>
  paginate(prisma, "ingreso", params);
export const obtenerIngresoPorId = (id: number, include?: Prisma.IngresoInclude) =>
  prisma.ingreso.findUnique({ where: { id }, include });
export const actualizarIngreso = (id: number, data: Prisma.IngresoUpdateInput, include?: Prisma.IngresoInclude) =>
  prisma.ingreso.update({ where: { id }, data, include });
export const eliminarIngresoPorId = (id: number) => prisma.ingreso.delete({ where: { id } });
export const ocuparPuesto = (id: number) => prisma.puesto.update({ where: { id }, data: { estado: "OCUPADO" } });
export const liberarPuesto = (id: number) => prisma.puesto.update({ where: { id }, data: { estado: "LIBRE" } });

export const buscarReservaActiva = (clienteId: number, vehiculoId: number, sucursalId?: number | null) => {
  const ahora = new Date();
  return prisma.reserva.findFirst({
    where: {
      clienteId,
      vehiculoId,
      ...(sucursalId !== undefined ? { sucursalId } : {}),
      estado: { in: ["PENDIENTE", "CONFIRMADA"] },
      fechaInicio: { lte: ahora },
      OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }],
    },
    include: { puesto: true },
    orderBy: { fechaInicio: "asc" },
  });
};

export const activarReserva = (id: number) =>
  prisma.reserva.update({ where: { id }, data: { estado: "ACTIVA" } });

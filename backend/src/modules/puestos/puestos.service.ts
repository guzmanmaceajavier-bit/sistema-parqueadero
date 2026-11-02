import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma.js";
import { paginate } from "../../utils/pagination.js";

export const crearPuesto = (data: Prisma.PuestoCreateInput | Prisma.PuestoUncheckedCreateInput) => prisma.puesto.create({ data });
export const crearPuestosMasivos = (data: Prisma.PuestoCreateManyInput[]) => prisma.puesto.createMany({ data, skipDuplicates: true });
export const obtenerPuestosPaginado = (params: Parameters<typeof paginate>[2] = {}) => paginate(prisma, "puesto", params);
export const obtenerTodosLosPuestos = (
  where?: Prisma.PuestoWhereInput,
  orderBy?: Prisma.PuestoOrderByWithRelationInput | Prisma.PuestoOrderByWithRelationInput[],
) => prisma.puesto.findMany({ where, orderBy });
export const obtenerPuestoPorId = (id: number) => prisma.puesto.findUnique({ where: { id } });
export const obtenerPuestoPorCodigo = (codigo: string) => prisma.puesto.findUnique({ where: { codigo } });
export const actualizarPuesto = (id: number, data: Prisma.PuestoUpdateInput | Prisma.PuestoUncheckedUpdateInput) => prisma.puesto.update({ where: { id }, data });
export const eliminarPuestoPorId = (id: number) => prisma.puesto.delete({ where: { id } });
export const eliminarFacturasDePuesto = (puestoId: number) => prisma.factura.deleteMany({ where: { ingreso: { puestoId } } });
export const eliminarIngresosDePuesto = (puestoId: number) => prisma.ingreso.deleteMany({ where: { puestoId } });
export const eliminarReservasDePuesto = (puestoId: number) => prisma.reserva.deleteMany({ where: { puestoId } });

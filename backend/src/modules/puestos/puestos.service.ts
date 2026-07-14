import prisma from "../../config/prisma.js";
import { paginate } from "../../utils/pagination.js";

export const crearPuesto = (data) => prisma.puesto.create({ data });
export const crearPuestosMasivos = (data) => prisma.puesto.createMany({ data, skipDuplicates: true });
export const obtenerPuestosPaginado = (params) => paginate(prisma, "puesto", params);
export const obtenerTodosLosPuestos = (where, orderBy) => prisma.puesto.findMany({ where, orderBy });
export const obtenerPuestoPorId = (id) => prisma.puesto.findUnique({ where: { id } });
export const obtenerPuestoPorCodigo = (codigo) => prisma.puesto.findUnique({ where: { codigo } });
export const actualizarPuesto = (id, data) => prisma.puesto.update({ where: { id }, data });
export const eliminarPuestoPorId = (id) => prisma.puesto.delete({ where: { id } });
export const eliminarFacturasDePuesto = (puestoId) => prisma.factura.deleteMany({ where: { ingreso: { puestoId } } });
export const eliminarIngresosDePuesto = (puestoId) => prisma.ingreso.deleteMany({ where: { puestoId } });
export const eliminarReservasDePuesto = (puestoId) => prisma.reserva.deleteMany({ where: { puestoId } });

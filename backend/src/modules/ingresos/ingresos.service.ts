import prisma from "../../config/prisma.js";
import { paginate } from "../../utils/pagination.js";

export const crearIngreso = (data, include) => prisma.ingreso.create({ data, include });
export const obtenerIngresosPaginado = (params) => paginate(prisma, "ingreso", params);
export const obtenerIngresoPorId = (id, include) => prisma.ingreso.findUnique({ where: { id }, include });
export const actualizarIngreso = (id, data, include) => prisma.ingreso.update({ where: { id }, data, include });
export const eliminarIngresoPorId = (id) => prisma.ingreso.delete({ where: { id } });
export const ocuparPuesto = (id) => prisma.puesto.update({ where: { id }, data: { estado: "OCUPADO" } });
export const liberarPuesto = (id) => prisma.puesto.update({ where: { id }, data: { estado: "LIBRE" } });
export const buscarReservaActiva = (clienteId) => prisma.reserva.findFirst({
  where: { clienteId, estado: { in: ["PENDIENTE", "CONFIRMADA"] }, fechaInicio: { lte: new Date() } },
  include: { puesto: true },
  orderBy: { fechaInicio: "asc" },
});
export const activarReserva = (id) => prisma.reserva.update({ where: { id }, data: { estado: "ACTIVA" } });

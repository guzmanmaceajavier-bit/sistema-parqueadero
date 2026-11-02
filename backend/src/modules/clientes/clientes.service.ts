import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma.js";
import { paginate } from "../../utils/pagination.js";

export const crearCliente = (data: Prisma.ClienteCreateInput) => prisma.cliente.create({ data });
export const obtenerClientesPaginado = (params: Parameters<typeof paginate>[2] = {}) => paginate(prisma, "cliente", params);
export const obtenerClientePorId = (id: number, include?: Prisma.ClienteInclude) => prisma.cliente.findUnique({ where: { id }, include });
export const obtenerClientePorDocumento = (documento: string) => prisma.cliente.findUnique({ where: { documento } });
export const actualizarCliente = (id: number, data: Prisma.ClienteUpdateInput) => prisma.cliente.update({ where: { id }, data });
export const eliminarClientePorId = (id: number) => prisma.cliente.delete({ where: { id } });
export const eliminarFacturasDeCliente = (clienteId: number) => prisma.factura.deleteMany({ where: { ingreso: { clienteId } } });
export const eliminarIngresosDeCliente = (clienteId: number) => prisma.ingreso.deleteMany({ where: { clienteId } });
export const eliminarMensualidadesDeCliente = (clienteId: number) => prisma.mensualidad.deleteMany({ where: { clienteId } });
export const eliminarReservasDeCliente = (clienteId: number) => prisma.reserva.deleteMany({ where: { clienteId } });
export const eliminarAusenciasDeCliente = (clienteId: number) => prisma.ausencia.deleteMany({ where: { clienteId } });
export const eliminarVehiculosDeCliente = (clienteId: number) => prisma.vehiculo.deleteMany({ where: { clienteId } });

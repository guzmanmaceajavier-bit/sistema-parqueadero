import prisma from "../../config/prisma.js";
import { paginate } from "../../utils/pagination.js";

export const crearCliente = (data) => prisma.cliente.create({ data });
export const obtenerClientesPaginado = (params) => paginate(prisma, "cliente", params);
export const obtenerClientePorId = (id, include) => prisma.cliente.findUnique({ where: { id }, include });
export const obtenerClientePorDocumento = (documento) => prisma.cliente.findUnique({ where: { documento } });
export const actualizarCliente = (id, data) => prisma.cliente.update({ where: { id }, data });
export const eliminarClientePorId = (id) => prisma.cliente.delete({ where: { id } });
export const eliminarFacturasDeCliente = (clienteId) => prisma.factura.deleteMany({ where: { ingreso: { clienteId } } });
export const eliminarIngresosDeCliente = (clienteId) => prisma.ingreso.deleteMany({ where: { clienteId } });
export const eliminarMensualidadesDeCliente = (clienteId) => prisma.mensualidad.deleteMany({ where: { clienteId } });
export const eliminarReservasDeCliente = (clienteId) => prisma.reserva.deleteMany({ where: { clienteId } });
export const eliminarAusenciasDeCliente = (clienteId) => prisma.ausencia.deleteMany({ where: { clienteId } });
export const eliminarVehiculosDeCliente = (clienteId) => prisma.vehiculo.deleteMany({ where: { clienteId } });

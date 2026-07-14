import prisma from "../../config/prisma.js";
import { paginate } from "../../utils/pagination.js";

export const crearVehiculo = (data, include) => prisma.vehiculo.create({ data, include });
export const obtenerVehiculosPaginado = (params) => paginate(prisma, "vehiculo", params);
export const obtenerVehiculoPorId = (id, include) => prisma.vehiculo.findUnique({ where: { id }, include });
export const obtenerVehiculoPorPlaca = (placa) => prisma.vehiculo.findUnique({ where: { placa } });
export const actualizarVehiculo = (id, data, include) => prisma.vehiculo.update({ where: { id }, data, include });
export const eliminarVehiculoPorId = (id) => prisma.vehiculo.delete({ where: { id } });
export const suspenderVehiculo = (id) => prisma.vehiculo.update({ where: { id }, data: { estado: false } });
export const contarIngresos = (vehiculoId) => prisma.ingreso.count({ where: { vehiculoId } });
export const contarMensualidades = (vehiculoId) => prisma.mensualidad.count({ where: { vehiculoId } });
export const contarReservas = (vehiculoId) => prisma.reserva.count({ where: { vehiculoId } });
export const contarAusencias = (vehiculoId) => prisma.ausencia.count({ where: { vehiculoId } });

import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma.js";
import { paginate } from "../../utils/pagination.js";

export const crearVehiculo = (data: Prisma.VehiculoCreateInput | Prisma.VehiculoUncheckedCreateInput, include?: Prisma.VehiculoInclude) => prisma.vehiculo.create({ data, include });
export const obtenerVehiculosPaginado = (params: Parameters<typeof paginate>[2] = {}) => paginate(prisma, "vehiculo", params);
export const obtenerVehiculoPorId = (id: number, include?: Prisma.VehiculoInclude) => prisma.vehiculo.findUnique({ where: { id }, include });
export const obtenerVehiculoPorPlaca = (placa: string) => prisma.vehiculo.findUnique({ where: { placa } });
export const actualizarVehiculo = (id: number, data: Prisma.VehiculoUpdateInput | Prisma.VehiculoUncheckedUpdateInput, include?: Prisma.VehiculoInclude) => prisma.vehiculo.update({ where: { id }, data, include });
export const eliminarVehiculoPorId = (id: number) => prisma.vehiculo.delete({ where: { id } });
export const suspenderVehiculo = (id: number) => prisma.vehiculo.update({ where: { id }, data: { estado: false } });
export const contarIngresos = (vehiculoId: number) => prisma.ingreso.count({ where: { vehiculoId } });
export const contarMensualidades = (vehiculoId: number) => prisma.mensualidad.count({ where: { vehiculoId } });
export const contarReservas = (vehiculoId: number) => prisma.reserva.count({ where: { vehiculoId } });
export const contarAusencias = (vehiculoId: number) => prisma.ausencia.count({ where: { vehiculoId } });

import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma.js";

export const obtenerConfiguracion = () => prisma.configuracion.findFirst();
export const crearConfiguracion = (data: Prisma.ConfiguracionCreateInput) => prisma.configuracion.create({ data });
export const actualizarConfiguracion = (id: number, data: Prisma.ConfiguracionUpdateInput) => prisma.configuracion.update({ where: { id }, data });

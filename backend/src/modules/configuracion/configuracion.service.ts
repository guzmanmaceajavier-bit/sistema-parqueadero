import prisma from "../../config/prisma.js";

export const obtenerConfiguracion = () => prisma.configuracion.findFirst();
export const crearConfiguracion = (data) => prisma.configuracion.create({ data });
export const actualizarConfiguracion = (id, data) => prisma.configuracion.update({ where: { id }, data });

import prisma from "../config/prisma.js";

export const registrarMovimiento = async (modulo, accion, descripcion, usuario = "admin") => {
  try {
    await prisma.movimiento.create({ data: { modulo, accion, descripcion, usuario } });
  } catch (error) {
    console.error("Error registrando movimiento:", error);
  }
};

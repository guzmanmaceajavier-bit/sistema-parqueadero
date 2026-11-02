import prisma from "../config/prisma.js";

export const registrarMovimiento = async (
  modulo: string,
  accion: string,
  descripcion: string,
  usuario = "admin",
  sucursalId?: number | null,
) => {
  try {
    // Si el módulo no pasa una sucursal explícita, toma la asignación actual
    // del usuario que ejecuta la acción. Los eventos de sistema quedan globales.
    let sucursalRegistro = sucursalId;
    if (sucursalRegistro === undefined) {
      const actor = await prisma.usuario.findUnique({
        where: { usuario },
        select: { sucursalId: true },
      });
      sucursalRegistro = actor?.sucursalId ?? null;
    }
    await prisma.movimiento.create({
      data: { modulo, accion, descripcion, usuario, sucursalId: sucursalRegistro },
    });
  } catch (error) {
    console.error("Error registrando movimiento:", error);
  }
};

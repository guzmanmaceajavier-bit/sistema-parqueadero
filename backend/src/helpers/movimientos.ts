import prisma from "../config/prisma.js";

/**
 * Registra el actor por ID además del nombre histórico.
 * Los registros automáticos o antiguos pueden no tener usuario asociado.
 * La escritura de auditoría nunca debe convertir una operación principal
 * exitosa en un error para el usuario.
 */
export const registrarMovimiento = async (
  modulo: string,
  accion: string,
  descripcion: string,
  usuario = "admin",
  sucursalId?: number | null,
) => {
  try {
    const actor = await prisma.usuario.findUnique({
      where: { usuario },
      select: { id: true, sucursalId: true },
    });
    const sucursalRegistro = sucursalId === undefined
      ? actor?.sucursalId ?? null
      : sucursalId;

    await prisma.movimiento.create({
      data: {
        modulo,
        accion,
        descripcion,
        usuario,
        usuarioId: actor?.id ?? null,
        sucursalId: sucursalRegistro,
      },
    });
  } catch (error) {
    console.error("Error registrando movimiento:", error);
  }
};

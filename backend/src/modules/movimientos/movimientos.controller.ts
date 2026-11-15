import prisma from "../../config/prisma.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { resolverSucursalPermitida } from "../../utils/sucursalAccess.js";

export const obtenerMovimientos = asyncHandler(async (req, res) => {
  const { page, limit, modulo, accion, q, usuarioId } = req.query;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const where: any = sucursalId ? { sucursalId } : {};

  if (modulo) where.modulo = modulo;
  if (accion) where.accion = accion;
  if (usuarioId) {
    const id = Number(usuarioId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: "El usuario seleccionado no es válido" });
    }
    where.usuarioId = id;
  }
  if (q) {
    where.OR = [
      { modulo: { contains: q, mode: "insensitive" } },
      { accion: { contains: q, mode: "insensitive" } },
      { descripcion: { contains: q, mode: "insensitive" } },
      { usuario: { contains: q, mode: "insensitive" } },
    ];
  }

  const { data: movimientos, pagination } = await paginate(prisma, "movimiento", {
    page,
    limit,
    where,
    include: {
      actor: { select: { id: true, nombre: true, usuario: true, rol: true } },
      sucursal: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ ok: true, movimientos, pagination });
});

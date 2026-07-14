import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { emitirEvento } from "../../services/socket.js";

export const obtenerMovimientos = asyncHandler(async (req, res) => {
  const { page, limit, modulo, accion, q } = req.query;
  const where = {};
  if (modulo) where.modulo = modulo;
  if (accion) where.accion = accion;
  if (q) {
    where.OR = [
      { modulo: { contains: q, mode: "insensitive" } },
      { accion: { contains: q, mode: "insensitive" } },
      { descripcion: { contains: q, mode: "insensitive" } },
    ];
  }
  const { data: movimientos, pagination } = await paginate(prisma, "movimiento", {
    page, limit, where, orderBy: { createdAt: "desc" },
  });
  res.json({ ok: true, movimientos, pagination });
});

export const crearMovimiento = asyncHandler(async (req, res) => {
  const { modulo, accion, descripcion, usuario } = req.body;
  if (!modulo || !accion || !descripcion) throw new AppError("Módulo, acción y descripción son requeridos", 400);
  const movimiento = await prisma.movimiento.create({
    data: { modulo, accion, descripcion, usuario: usuario || req.usuario?.usuario || "admin" },
  });
  emitirEvento("movimiento:creado", { mensaje: `Movimiento registrado: ${modulo} - ${accion}`, movimiento });
  res.status(201).json({ ok: true, movimiento });
});

export const actualizarMovimiento = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existe = await prisma.movimiento.findUnique({ where: { id: Number(id) } });
  if (!existe) throw new AppError("Movimiento no encontrado", 404);
  const { modulo, accion, descripcion } = req.body;
  const data = {};
  if (modulo) data.modulo = modulo;
  if (accion) data.accion = accion;
  if (descripcion !== undefined) data.descripcion = descripcion;
  const movimiento = await prisma.movimiento.update({ where: { id: Number(id) }, data });
  emitirEvento("movimiento:actualizado", { mensaje: `Movimiento #${id} actualizado`, movimiento });
  res.json({ ok: true, movimiento });
});

export const eliminarMovimiento = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existe = await prisma.movimiento.findUnique({ where: { id: Number(id) } });
  if (!existe) throw new AppError("Movimiento no encontrado", 404);
  await prisma.movimiento.delete({ where: { id: Number(id) } });
  emitirEvento("movimiento:eliminado", { mensaje: `Movimiento #${id} eliminado` });
  res.json({ ok: true, message: "Movimiento eliminado" });
});

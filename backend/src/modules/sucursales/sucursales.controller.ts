import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";

export const listarSucursales = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  if (page) {
    const result = await paginate(prisma, "sucursal", { page, limit, orderBy: { id: "desc" } });
    return res.json({ ok: true, ...result });
  }
  const data = await prisma.sucursal.findMany({ orderBy: { id: "desc" } });
  res.json({ ok: true, sucursales: data });
});

export const crearSucursal = asyncHandler(async (req, res) => {
  const { nombre, direccion, telefono } = req.body;
  if (typeof nombre !== "string" || !nombre.trim()) throw new AppError("El nombre de la sucursal es requerido", 400);
  if (nombre.trim().length > 100) throw new AppError("El nombre no puede superar 100 caracteres", 400);
  const nueva = await prisma.sucursal.create({ data: { nombre: nombre.trim(), direccion, telefono } });
  res.status(201).json({ ok: true, sucursal: nueva });
});

export const actualizarSucursal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nombre, direccion, telefono, estado } = req.body;
  const existente = await prisma.sucursal.findUnique({ where: { id: Number(id) } });
  if (!existente) throw new AppError("Sucursal no encontrada", 404);

  const data: { nombre?: string; direccion?: string | null; telefono?: string | null; estado?: boolean } = {};
  if (nombre !== undefined) {
    if (typeof nombre !== "string" || !nombre.trim()) throw new AppError("El nombre de la sucursal es requerido", 400);
    if (nombre.trim().length > 100) throw new AppError("El nombre no puede superar 100 caracteres", 400);
    data.nombre = nombre.trim();
  }
  if (direccion !== undefined) data.direccion = direccion;
  if (telefono !== undefined) data.telefono = telefono;
  if (estado !== undefined) data.estado = Boolean(estado);

  const sucursal = await prisma.sucursal.update({ where: { id: Number(id) }, data });
  res.json({ ok: true, sucursal });
});

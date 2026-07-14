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
  const nueva = await prisma.sucursal.create({ data: { nombre, direccion, telefono } });
  res.status(201).json({ ok: true, sucursal: nueva });
});

export const actualizarSucursal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nombre, direccion, telefono, estado } = req.body;
  const data = await prisma.sucursal.update({ where: { id: Number(id) }, data: { nombre, direccion, telefono, estado } });
  res.json({ ok: true, sucursal: data });
});

import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";

export const crearTarifa = asyncHandler(async (req, res) => {
  const { nombre, tipoVehiculo, modalidad, valor, minutosCortesia, descripcion } = req.body;
  if (!nombre) throw new AppError("Nombre es requerido", 400);
  const tarifa = await prisma.tarifa.create({
    data: { nombre, tipoVehiculo, modalidad, valor: Number(valor), minutosCortesia: minutosCortesia ? Number(minutosCortesia) : 0, descripcion },
  });
  await registrarMovimiento("TARIFAS", "CREAR", `Tarifa creada: ${tarifa.nombre}`, req.usuario?.usuario || "admin");
  res.status(201).json({ ok: true, tarifa });
});

export const obtenerTarifas = asyncHandler(async (req, res) => {
  const { page, limit, q } = req.query;
  const where = {};
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { tipoVehiculo: { contains: q, mode: "insensitive" } },
      { modalidad: { contains: q, mode: "insensitive" } },
    ];
  }
  if (page) {
    const { data: tarifas, pagination } = await paginate(prisma, "tarifa", { page, limit, where, orderBy: { id: "desc" } });
    return res.json({ ok: true, tarifas, pagination });
  }
  const tarifas = await prisma.tarifa.findMany({ where, orderBy: { id: "desc" } });
  res.json({ ok: true, tarifas });
});

export const obtenerTarifa = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tarifa = await prisma.tarifa.findUnique({ where: { id: Number(id) } });
  if (!tarifa) throw new AppError("Tarifa no encontrada", 404);
  res.json({ ok: true, tarifa });
});

export const actualizarTarifa = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nombre, tipoVehiculo, modalidad, valor, minutosCortesia, descripcion, activa } = req.body;

  const existe = await prisma.tarifa.findUnique({ where: { id: Number(id) } });
  if (!existe) throw new AppError("Tarifa no encontrada", 404);

  const data = {};
  if (nombre) data.nombre = nombre;
  if (tipoVehiculo) data.tipoVehiculo = tipoVehiculo;
  if (modalidad) data.modalidad = modalidad;
  if (valor !== undefined) data.valor = Number(valor);
  if (minutosCortesia !== undefined) data.minutosCortesia = Number(minutosCortesia);
  if (descripcion !== undefined) data.descripcion = descripcion;
  if (activa !== undefined) data.activa = activa;

  const tarifa = await prisma.tarifa.update({ where: { id: Number(id) }, data });
  await registrarMovimiento("TARIFAS", "ACTUALIZAR", `Tarifa #${id}: ${tarifa.nombre}`, req.usuario?.usuario || "admin");
  res.json({ ok: true, tarifa });
});

export const eliminarTarifa = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existe = await prisma.tarifa.findUnique({ where: { id: Number(id) } });
  if (!existe) throw new AppError("Tarifa no encontrada", 404);
  await prisma.tarifa.delete({ where: { id: Number(id) } });
  await registrarMovimiento("TARIFAS", "ELIMINAR", `Tarifa #${id}: ${existe.nombre}`, req.usuario?.usuario || "admin");
  res.json({ ok: true, message: "Tarifa eliminada" });
});

import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";

export const crearPlan = asyncHandler(async (req, res) => {
  const { nombre, descripcion, duracionDias, valor, tipoVehiculo } = req.body;
  if (!nombre || !duracionDias || !valor) throw new AppError("nombre, duracionDias y valor son requeridos", 400);

  const plan = await prisma.plan.create({
    data: { nombre, descripcion, duracionDias: Number(duracionDias), valor: Number(valor), tipoVehiculo: tipoVehiculo || "todos" },
  });
  await registrarMovimiento("PLANES", "CREAR", `Plan ${plan.nombre} creado`, req.usuario?.usuario);
  res.status(201).json({ ok: true, plan });
});

export const obtenerPlanes = asyncHandler(async (req, res) => {
  const { page, limit, q } = req.query;
  const where = {};
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { descripcion: { contains: q, mode: "insensitive" } },
      { tipoVehiculo: { contains: q, mode: "insensitive" } },
    ];
  }
  if (page) {
    const { data: planes, pagination } = await paginate(prisma, "plan", { page, limit, where, orderBy: { id: "desc" } });
    return res.json({ ok: true, planes, pagination });
  }
  const planes = await prisma.plan.findMany({ where, orderBy: { id: "desc" } });
  res.json({ ok: true, planes });
});

export const obtenerPlan = asyncHandler(async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: Number(req.params.id) } });
  if (!plan) throw new AppError("Plan no encontrado", 404);
  res.json({ ok: true, plan });
});

export const actualizarPlan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, duracionDias, valor, tipoVehiculo, activo } = req.body;

  const existe = await prisma.plan.findUnique({ where: { id: Number(id) } });
  if (!existe) throw new AppError("Plan no encontrado", 404);

  const data = {};
  if (nombre !== undefined) data.nombre = nombre;
  if (descripcion !== undefined) data.descripcion = descripcion;
  if (duracionDias !== undefined) data.duracionDias = Number(duracionDias);
  if (valor !== undefined) data.valor = Number(valor);
  if (tipoVehiculo !== undefined) data.tipoVehiculo = tipoVehiculo;
  if (activo !== undefined) data.activo = activo;

  const plan = await prisma.plan.update({ where: { id: Number(id) }, data });
  await registrarMovimiento("PLANES", "ACTUALIZAR", `Plan ${plan.nombre} actualizado`, req.usuario?.usuario);
  res.json({ ok: true, plan });
});

export const eliminarPlan = asyncHandler(async (req, res) => {
  const plan = await prisma.plan.delete({ where: { id: Number(req.params.id) } });
  await registrarMovimiento("PLANES", "ELIMINAR", `Plan ${plan.nombre} eliminado`, req.usuario?.usuario);
  res.json({ ok: true, message: "Plan eliminado" });
});

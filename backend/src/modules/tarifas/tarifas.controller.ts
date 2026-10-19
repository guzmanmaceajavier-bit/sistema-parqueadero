import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";

export const crearTarifa = asyncHandler(async (req, res) => {
  const { nombre, tipoVehiculo, modalidad, valor, minutosCortesia, descripcion } = req.body;
  if (!nombre) throw new AppError("Nombre es requerido", 400);
  if (!tipoVehiculo) throw new AppError("Tipo de vehículo es requerido", 400);
  if (!modalidad) throw new AppError("Modalidad es requerida", 400);
  const val = Number(valor);
  if (!val || val < 0) throw new AppError("Valor debe ser un número válido y no negativo", 400);
  const tarifa = await prisma.tarifa.create({
    data: { nombre, tipoVehiculo, modalidad, valor: val, minutosCortesia: minutosCortesia ? Number(minutosCortesia) : 0, descripcion },
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
  if (valor !== undefined) { const v = Number(valor); if (!v && v !== 0) throw new AppError("Valor debe ser un número válido", 400); if (v < 0) throw new AppError("Valor no puede ser negativo", 400); data.valor = v; }
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

  const ingresos = await prisma.ingreso.count({ where: { tarifaId: Number(id) } });
  const facturas = await prisma.factura.count({ where: { tarifaId: Number(id) } });

  if (ingresos > 0 || facturas > 0) {
    await prisma.tarifa.update({ where: { id: Number(id) }, data: { activa: false } });
    await registrarMovimiento("TARIFAS", "DESACTIVAR", `Tarifa #${id}: ${existe.nombre} desactivada (tiene registros asociados)`, req.usuario?.usuario || "admin");
    return res.json({ ok: true, message: "Tarifa desactivada (tiene registros históricos asociados)" });
  }

  await prisma.tarifa.delete({ where: { id: Number(id) } });
  await registrarMovimiento("TARIFAS", "ELIMINAR", `Tarifa #${id}: ${existe.nombre}`, req.usuario?.usuario || "admin");
  res.json({ ok: true, message: "Tarifa eliminada" });
});

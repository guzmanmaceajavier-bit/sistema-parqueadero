import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";

export const crearVehiculo = asyncHandler(async (req, res) => {
  let { placa, marca, modelo, color, tipo, clase, observaciones, clienteId, tipoCobro, planId, tarifaId } = req.body;
  if (!placa) throw new AppError("Placa es requerida", 400);
  if (!clienteId) throw new AppError("Cliente es requerido", 400);

  placa = placa.toUpperCase().trim();
  const existente = await prisma.vehiculo.findUnique({
    where: { placa },
    include: { cliente: { select: { id: true, nombres: true, apellidos: true } } },
  });
  if (existente) {
    const dueno = existente.cliente ? `${existente.cliente.nombres} ${existente.cliente.apellidos}` : "otro cliente";
    throw new AppError(`La placa ${placa} ya pertenece a ${dueno}`, 400);
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: Number(clienteId) } });
  if (!cliente) throw new AppError("Cliente no encontrado", 404);

  const data: any = {
    placa, marca, modelo, color, tipo, clase, observaciones,
    clienteId: Number(clienteId),
    tipoCobro: tipoCobro || "NINGUNO",
    creadoPorPlan: tipoCobro === "PLAN",
  };

  if (planId) {
    const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
    if (!plan) throw new AppError("Plan no encontrado", 404);
    data.planId = Number(planId);
  }

  if (tarifaId) {
    const tarifa = await prisma.tarifa.findUnique({ where: { id: Number(tarifaId) } });
    if (!tarifa) throw new AppError("Tarifa no encontrada", 404);
    data.tarifaId = Number(tarifaId);
  }

  const vehiculo = await prisma.vehiculo.create({
    data,
    include: { cliente: true, plan: true, tarifa: true },
  });
  await registrarMovimiento("VEHICULOS", "CREAR", `Vehículo ${vehiculo.placa} creado para ${cliente.nombres} ${cliente.apellidos} (tipo cobro: ${tipoCobro || "NINGUNO"})`, req.usuario?.usuario || "admin");
  res.status(201).json({ ok: true, vehiculo });
});

export const obtenerVehiculos = asyncHandler(async (req, res) => {
  const { page, limit, clienteId, q } = req.query;
  const where = {};
  if (clienteId) where.clienteId = Number(clienteId);
  if (q) {
    where.OR = [
      { placa: { contains: q, mode: "insensitive" } },
      { marca: { contains: q, mode: "insensitive" } },
    ];
  }

  const { data: vehiculos, pagination } = await paginate(prisma, "vehiculo", {
    page, limit, where, include: { cliente: true }, orderBy: { id: "desc" },
  });
  res.json({ ok: true, vehiculos, pagination });
});

export const obtenerVehiculo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const vehiculo = await prisma.vehiculo.findUnique({
    where: { id: Number(id) },
    include: { cliente: true },
  });
  if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
  res.json({ ok: true, vehiculo });
});

export const actualizarVehiculo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existe = await prisma.vehiculo.findUnique({ where: { id: Number(id) } });
  if (!existe) throw new AppError("Vehículo no encontrado", 404);

  const { placa, marca, modelo, color, tipo, clase, observaciones, clienteId, bloqueado, tipoCobro, planId, tarifaId } = req.body;
  const data: any = {};
  if (placa) {
    const placaUpper = placa.toUpperCase().trim();
    if (placaUpper !== existe.placa) {
      const dup = await prisma.vehiculo.findUnique({
        where: { placa: placaUpper },
        include: { cliente: { select: { nombres: true, apellidos: true } } },
      });
      if (dup) {
        const dueno = dup.cliente ? `${dup.cliente.nombres} ${dup.cliente.apellidos}` : "otro cliente";
        throw new AppError(`La placa ${placaUpper} ya pertenece a ${dueno}`, 400);
      }
    }
    data.placa = placaUpper;
  }
  if (marca !== undefined) data.marca = marca;
  if (modelo !== undefined) data.modelo = modelo;
  if (color !== undefined) data.color = color;
  if (tipo) data.tipo = tipo;
  if (clase) data.clase = clase;
  if (observaciones !== undefined) data.observaciones = observaciones;
  if (clienteId) data.clienteId = Number(clienteId);
  if (bloqueado !== undefined) data.bloqueado = bloqueado;
  if (tipoCobro !== undefined) {
    data.tipoCobro = tipoCobro;
    data.creadoPorPlan = tipoCobro === "PLAN";
  }
  if (planId !== undefined) {
    if (planId) {
      const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
      if (!plan) throw new AppError("Plan no encontrado", 404);
      data.planId = Number(planId);
    } else {
      data.planId = null;
    }
  }
  if (tarifaId !== undefined) {
    if (tarifaId) {
      const tarifa = await prisma.tarifa.findUnique({ where: { id: Number(tarifaId) } });
      if (!tarifa) throw new AppError("Tarifa no encontrada", 404);
      data.tarifaId = Number(tarifaId);
    } else {
      data.tarifaId = null;
    }
  }

  const vehiculo = await prisma.vehiculo.update({ where: { id: Number(id) }, data, include: { cliente: true, plan: true, tarifa: true } });
  res.json({ ok: true, vehiculo });
});

export const eliminarVehiculo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: Number(id) } });
  if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);

  const ingresos = await prisma.ingreso.count({ where: { vehiculoId: Number(id) } });
  const mensualidades = await prisma.mensualidad.count({ where: { vehiculoId: Number(id) } });
  const reservas = await prisma.reserva.count({ where: { vehiculoId: Number(id) } });
  const ausencias = await prisma.ausencia.count({ where: { vehiculoId: Number(id) } });

  if (ingresos > 0 || mensualidades > 0 || reservas > 0 || ausencias > 0) {
    await prisma.vehiculo.update({ where: { id: Number(id) }, data: { estado: false } });
    await registrarMovimiento("VEHICULOS", "SUSPENDER", `Vehículo ${vehiculo.placa} suspendido (tiene registros asociados)`, req.usuario?.usuario || "admin");
    return res.json({ ok: true, message: "Vehículo suspendido (tiene registros asociados)" });
  }

  await prisma.vehiculo.delete({ where: { id: Number(id) } });
  await registrarMovimiento("VEHICULOS", "ELIMINAR", `Vehículo ${vehiculo.placa} eliminado`, req.usuario?.usuario || "admin");
  res.json({ ok: true, message: "Vehículo eliminado" });
});

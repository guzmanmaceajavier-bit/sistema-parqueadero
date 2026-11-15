import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { resolverSucursalPermitida } from "../../utils/sucursalAccess.js";

/** Normaliza la placa: mayúsculas, sin espacios ni guiones. */
const normalizarPlaca = (valor: string): string => String(valor).toUpperCase().replace(/[\s-]+/g, "").trim();

export const crearVehiculo = asyncHandler(async (req, res) => {
  let { placa, marca, modelo, color, tipo, clase, observaciones, clienteId, tipoCobro, planId, tarifaId } = req.body;
  if (!placa) throw new AppError("Placa es requerida", 400);
  if (!clienteId) throw new AppError("Cliente es requerido", 400);

  placa = normalizarPlaca(placa);
  if (!placa) throw new AppError("Placa es requerida", 400);
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

  const sucursalId = resolverSucursalPermitida(req.usuario, req.body.sucursalId);
  const data: any = {
    placa, marca, modelo, color, tipo, clase, observaciones,
    clienteId: Number(clienteId),
    sucursalId: sucursalId ?? null,
    tipoCobro: tipoCobro || "NINGUNO",
    creadoPorPlan: tipoCobro === "PLAN",
  };

  if (planId) {
    const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
    if (!plan) throw new AppError("Plan no encontrado", 404);
    data.planId = Number(planId);
  }

  if (tarifaId) {
    const tarifa = await prisma.tarifa.findFirst({ where: { id: Number(tarifaId), OR: [{ sucursalId: sucursalId ?? null }, { sucursalId: null }] } });
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
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const where: any = sucursalId ? { sucursalId } : {};
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
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const vehiculo = await prisma.vehiculo.findFirst({
    where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) },
    include: {
      cliente: { select: { id: true, nombres: true, apellidos: true, documento: true, telefono: true, email: true } },
      propietarios: {
        include: { cliente: { select: { id: true, nombres: true, apellidos: true, documento: true } } },
        orderBy: { desde: "desc" },
      },
      ingresos: {
        select: {
          id: true, fechaEntrada: true, fechaSalida: true, estado: true,
          tiempoMinutos: true, valorPagado: true, ticketExtraviado: true,
          puesto: { select: { id: true, codigo: true } },
        },
        orderBy: { fechaEntrada: "desc" },
        take: 50,
      },
      mensualidades: {
        select: {
          id: true, fechaInicio: true, fechaFin: true, valor: true, estado: true,
          observacion: true, plan: { select: { id: true, nombre: true } },
          puesto: { select: { id: true, codigo: true } },
        },
        orderBy: { fechaInicio: "desc" },
        take: 50,
      },
      ausencias: {
        select: {
          id: true, fechaSalida: true, fechaRegreso: true, motivo: true, estado: true,
          opcion: true, diasCompensados: true, valorCompensado: true, compensacionDetalle: true,
        },
        orderBy: { fechaSalida: "desc" },
        take: 50,
      },
      reservas: {
        select: {
          id: true, fechaReserva: true, fechaInicio: true, fechaFin: true, estado: true,
          observaciones: true, puesto: { select: { id: true, codigo: true } },
        },
        orderBy: { fechaInicio: "desc" },
        take: 50,
      },
    },
  });
  if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
  const propietarios = vehiculo.propietarios.length > 0
    ? vehiculo.propietarios
    : [{
        id: 0,
        vehiculoId: vehiculo.id,
        clienteId: vehiculo.clienteId,
        desde: vehiculo.createdAt,
        hasta: null,
        cliente: vehiculo.cliente,
      }];
  res.json({
    ok: true,
    vehiculo: { ...vehiculo, propietarios },
    historial: {
      propietarios,
      ingresos: vehiculo.ingresos,
      mensualidades: vehiculo.mensualidades,
      ausencias: vehiculo.ausencias,
      reservas: vehiculo.reservas,
    },
  });
});

export const actualizarVehiculo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const existe = await prisma.vehiculo.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) } });
  if (!existe) throw new AppError("Vehículo no encontrado", 404);

  const { placa, marca, modelo, color, tipo, clase, observaciones, clienteId, bloqueado, tipoCobro, planId, tarifaId } = req.body;
  const data: any = {};
  if (placa) {
    const placaUpper = normalizarPlaca(placa);
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
      const tarifa = await prisma.tarifa.findFirst({ where: { id: Number(tarifaId), OR: [{ sucursalId: existe.sucursalId ?? null }, { sucursalId: null }] } });
      if (!tarifa) throw new AppError("Tarifa no encontrada", 404);
      data.tarifaId = Number(tarifaId);
    } else {
      data.tarifaId = null;
    }
  }

  // Historial de propietarios: si cambia el dueño, se cierra el período
  // anterior y se abre el nuevo (conserva quién era el dueño y desde cuándo).
  const cambiaPropietario = clienteId !== undefined && Number(clienteId) !== existe.clienteId;
  if (cambiaPropietario) {
    const nuevoClienteId = Number(clienteId);
    const nuevo = await prisma.cliente.findUnique({ where: { id: nuevoClienteId }, select: { id: true } });
    if (!nuevo) throw new AppError("Cliente no encontrado", 404);

    await prisma.$transaction(async (tx) => {
      const propietarioActual = await tx.vehiculoPropietario.findFirst({
        where: { vehiculoId: Number(id), hasta: null },
        select: { id: true },
      });
      // Si el vehículo nunca había cambiado de dueño, registra también al
      // propietario inicial antes de cerrar su período.
      if (!propietarioActual) {
        await tx.vehiculoPropietario.create({
          data: { vehiculoId: Number(id), clienteId: existe.clienteId, desde: existe.createdAt },
        });
      }
      await tx.vehiculoPropietario.updateMany({
        where: { vehiculoId: Number(id), hasta: null },
        data: { hasta: new Date() },
      });
      await tx.vehiculoPropietario.create({
        data: { vehiculoId: Number(id), clienteId: nuevoClienteId, desde: new Date() },
      });
      await tx.vehiculo.update({ where: { id: Number(id) }, data: { clienteId: nuevoClienteId } });
    });
    delete data.clienteId;
    await registrarMovimiento(
      "VEHICULOS",
      "CAMBIAR_PROPIETARIO",
      `Vehículo ${existe.placa} cambió de propietario`,
      req.usuario?.usuario || "admin",
    );
  }

  const vehiculo = await prisma.vehiculo.update({ where: { id: Number(id) }, data, include: { cliente: true, plan: true, tarifa: true } });
  if (Object.keys(data).length > 0) {
    await registrarMovimiento(
      "VEHICULOS",
      "ACTUALIZAR",
      `Ficha del vehículo ${vehiculo.placa} actualizada`,
      req.usuario?.usuario || "admin",
    );
  }
  res.json({ ok: true, vehiculo });
});

export const eliminarVehiculo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const vehiculo = await prisma.vehiculo.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) } });
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

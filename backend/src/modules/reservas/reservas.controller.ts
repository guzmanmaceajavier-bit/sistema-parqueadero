import prisma from "../../config/prisma.js";
import type { Prisma } from "@prisma/client";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { emitirEvento } from "../../services/socket.js";
import { resolverSucursalPermitida } from "../../utils/sucursalAccess.js";

const ESTADOS = ["PENDIENTE", "CONFIRMADA", "ACTIVA", "FINALIZADA", "CANCELADA", "NO_SHOW"];

async function ocuparPuesto(puestoId: number, usuario?: string) {
  await prisma.puesto.update({ where: { id: Number(puestoId) }, data: { estado: "RESERVADO" } });
  await registrarMovimiento("PUESTOS", "RESERVAR", `Puesto #${puestoId} reservado`, usuario);
}

async function liberarPuesto(puestoId: number, usuario?: string, motivo = "liberado") {
  await prisma.puesto.update({ where: { id: Number(puestoId) }, data: { estado: "LIBRE" } });
  await registrarMovimiento("PUESTOS", "LIBERAR", `Puesto #${puestoId} ${motivo}`, usuario);
}

export const crearReserva = asyncHandler(async (req, res) => {
  const { clienteId, vehiculoId, puestoId, fechaInicio, fechaFin, observaciones } = req.body;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.body.sucursalId);

  const cid = Number(clienteId);
  const vid = vehiculoId ? Number(vehiculoId) : null;
  const pid = puestoId ? Number(puestoId) : null;

  const inicio = new Date(fechaInicio);
  if (!Number.isFinite(inicio.getTime())) throw new AppError("La fecha de inicio no es válida", 400);
  const MARGEN_MS = 5 * 60 * 1000;
  if (inicio.getTime() < Date.now() - MARGEN_MS) throw new AppError("La fecha de inicio debe ser futura", 400);

  const cliente = await prisma.cliente.findUnique({ where: { id: cid } });
  if (!cliente) throw new AppError("Cliente no encontrado", 404);
  if (cliente.bloqueado) throw new AppError("El cliente está bloqueado", 400);

  let vehiculo = null;
  if (vid) {
    vehiculo = await prisma.vehiculo.findUnique({ where: { id: vid } });
    if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
    if (sucursalId && vehiculo.sucursalId !== sucursalId) throw new AppError("El vehículo pertenece a otra sucursal", 403);
    if (vehiculo.clienteId !== cid) throw new AppError("El vehículo no pertenece al cliente seleccionado", 400);
    if (vehiculo.bloqueado) throw new AppError("El vehículo está bloqueado", 400);
    if (!vehiculo.estado) throw new AppError("El vehículo está inactivo", 400);
  }

  let puesto = null;
  if (pid) {
    puesto = await prisma.puesto.findUnique({ where: { id: pid } });
    if (!puesto) throw new AppError("Puesto no encontrado", 404);
    if (sucursalId && puesto.sucursalId !== sucursalId) throw new AppError("El puesto pertenece a otra sucursal", 403);
    if (!puesto.activo) throw new AppError("El puesto está inactivo", 400);
    if (puesto.estado === "MANTENIMIENTO") throw new AppError("El puesto está en mantenimiento", 400);
    if (puesto.estado === "OCUPADO") throw new AppError("El puesto está ocupado", 400);
  }

  if (vid) {
    const duplicado = await prisma.reserva.findFirst({
      where: {
        vehiculoId: vid,
        sucursalId: sucursalRegistro,
        estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
      },
    });
    if (duplicado) throw new AppError("El vehículo ya tiene una reserva activa (pendiente, confirmada o activa)", 400);
  }

  const fin = fechaFin ? new Date(fechaFin) : null;
  if (fechaFin && (!fin || !Number.isFinite(fin.getTime()))) throw new AppError("La fecha fin no es válida", 400);
  if (fin && fin <= inicio) throw new AppError("La fecha fin debe ser posterior a la fecha inicio", 400);

  if (pid && vehiculo && vehiculo.sucursalId !== puesto?.sucursalId) {
    throw new AppError("El vehículo y el puesto deben pertenecer a la misma sucursal", 409);
  }
  const sucursalRegistro = sucursalId ?? vehiculo?.sucursalId ?? puesto?.sucursalId ?? null;

  if (pid) {
    const conflicto = await prisma.reserva.findFirst({
      where: {
        puestoId: pid,
        sucursalId: sucursalRegistro,
        estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
        fechaInicio: { lt: fin || new Date("9999-12-31T23:59:59.999Z") },
        OR: [{ fechaFin: null }, { fechaFin: { gte: inicio } }],
      },
    });
    if (conflicto) throw new AppError("El puesto ya tiene una reserva en ese rango de fechas", 409);
  }

  const reserva = await prisma.$transaction(async (tx) => {
    // Serializa la reserva por vehículo y puesto para evitar solapamientos simultáneos.
    if (vid) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${vid}::integer)) AS advisory_lock`;
    if (pid) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${pid}::integer)) AS advisory_lock`;

    const finLimite = fin || new Date("9999-12-31T23:59:59.999Z");
    if (vid) {
      const [reservaVehiculo, mensualidadVehiculo, ingresoVehiculo] = await Promise.all([
        tx.reserva.findFirst({
          where: { vehiculoId: vid, sucursalId: sucursalRegistro, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            fechaInicio: { lt: finLimite }, OR: [{ fechaFin: null }, { fechaFin: { gte: inicio } }] },
          select: { id: true },
        }),
        tx.mensualidad.findFirst({
          where: { vehiculoId: vid, sucursalId: sucursalRegistro, estado: "ACTIVA", fechaInicio: { lt: finLimite }, fechaFin: { gte: inicio } },
          select: { id: true },
        }),
        tx.ingreso.findFirst({ where: { vehiculoId: vid, vehiculo: { sucursalId: sucursalRegistro }, estado: "ACTIVO" }, select: { id: true } }),
      ]);
      if (reservaVehiculo) throw new AppError("El vehículo ya tiene una reserva en ese periodo", 409);
      if (mensualidadVehiculo) throw new AppError("El vehículo tiene una mensualidad que se cruza con ese periodo", 409);
      if (ingresoVehiculo) throw new AppError("El vehículo ya tiene un ingreso activo", 409);
    }
    if (pid) {
      const [conflictoPuesto, mensualidadPuesto, ingresoPuesto] = await Promise.all([
        tx.reserva.findFirst({
          where: { puestoId: pid, sucursalId: sucursalRegistro, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            fechaInicio: { lt: finLimite }, OR: [{ fechaFin: null }, { fechaFin: { gte: inicio } }] },
          select: { id: true },
        }),
        tx.mensualidad.findFirst({
          where: { puestoId: pid, sucursalId: sucursalRegistro, estado: "ACTIVA", fechaInicio: { lt: finLimite }, fechaFin: { gte: inicio } },
          select: { id: true },
        }),
        tx.ingreso.findFirst({ where: { puestoId: pid, vehiculo: { sucursalId: sucursalRegistro }, estado: "ACTIVO" }, select: { id: true } }),
      ]);
      if (conflictoPuesto || mensualidadPuesto || ingresoPuesto) {
        throw new AppError("El puesto tiene otra ocupación o asignación en ese periodo", 409);
      }
    }

    const creada = await tx.reserva.create({
      data: { clienteId: cid, vehiculoId: vid, puestoId: pid, fechaInicio: inicio, fechaFin: fin, observaciones, sucursalId: sucursalRegistro },
      include: { cliente: true, vehiculo: true, puesto: true },
    });
    if (pid) await tx.puesto.update({ where: { id: pid }, data: { estado: "RESERVADO" } });
    return creada;
  });
  const codPuesto = puesto?.codigo || "sin asignar";
  await registrarMovimiento("RESERVAS", "CREAR", `Reserva #${reserva.id} — ${cliente.nombres} → puesto ${codPuesto}`, req.usuario?.usuario);
  emitirEvento("reserva:creada", { mensaje: `Nueva reserva de ${cliente.nombres} para puesto ${codPuesto}`, reserva });
  res.status(201).json({ ok: true, reserva });
});

export const obtenerReservas = asyncHandler(async (req, res) => {
  const { page, limit, estado, clienteId, puestoId, desde, hasta, q } = req.query;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const where: Prisma.ReservaWhereInput = sucursalId ? { sucursalId } : {};
  if (typeof estado === "string") where.estado = estado as string;
  if (typeof clienteId === "string") where.clienteId = Number(clienteId);
  if (typeof puestoId === "string") where.puestoId = Number(puestoId);
  if (typeof desde === "string" || typeof hasta === "string") {
    where.fechaInicio = {};
    if (typeof desde === "string") where.fechaInicio.gte = new Date(desde);
    if (typeof hasta === "string") where.fechaInicio.lte = new Date(hasta);
  }
  if (typeof q === "string") {
    where.OR = [
      { cliente: { nombres: { contains: q, mode: "insensitive" } } },
      { cliente: { apellidos: { contains: q, mode: "insensitive" } } },
      { vehiculo: { placa: { contains: q, mode: "insensitive" } } },
      { puesto: { codigo: { contains: q, mode: "insensitive" } } },
    ];
  }

  const { data: reservas, pagination } = await paginate(prisma, "reserva", {
    page, limit, where,
    include: { cliente: true, vehiculo: true, puesto: true },
    orderBy: { fechaInicio: "desc" },
  });
  res.json({ ok: true, reservas, pagination });
});

export const obtenerReserva = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const reserva = await prisma.reserva.findFirst({
    where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) },
    include: { cliente: true, vehiculo: true, puesto: true },
  });
  if (!reserva) throw new AppError("Reserva no encontrada", 404);
  res.json({ ok: true, reserva });
});

export const actualizarReserva = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { estado, vehiculoId, puestoId, fechaInicio, fechaFin, observaciones } = req.body;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const existente = await prisma.reserva.findFirst({ where: { id, ...(sucursalId ? { sucursalId } : {}) }, include: { vehiculo: { select: { sucursalId: true } }, puesto: { select: { sucursalId: true } } } });
  if (!existente) throw new AppError("Reserva no encontrada", 404);
  if (["FINALIZADA", "CANCELADA", "NO_SHOW", "ACTIVA"].includes(existente.estado)) {
    throw new AppError("Solo se pueden editar reservas pendientes o confirmadas", 409);
  }
  if (estado !== undefined) {
    throw new AppError("El estado debe modificarse mediante la acción de cambio de estado", 400);
  }

  const nuevoVehiculoId = vehiculoId !== undefined ? (vehiculoId ? Number(vehiculoId) : null) : existente.vehiculoId;
  const nuevoPuestoId = puestoId !== undefined ? (puestoId ? Number(puestoId) : null) : existente.puestoId;
  const inicio = fechaInicio !== undefined ? new Date(fechaInicio) : existente.fechaInicio;
  const fin = fechaFin !== undefined ? (fechaFin ? new Date(fechaFin) : null) : existente.fechaFin;
  if (!Number.isFinite(inicio.getTime())) throw new AppError("La fecha de inicio no es válida", 400);
  if (fechaFin && (!fin || !Number.isFinite(fin.getTime()))) throw new AppError("La fecha fin no es válida", 400);
  if (fin && fin <= inicio) throw new AppError("La fecha fin debe ser posterior a la fecha inicio", 400);

  const sucursalOrigen = existente.sucursalId ?? existente.vehiculo?.sucursalId ?? existente.puesto?.sucursalId ?? sucursalId ?? null;
  if (nuevoVehiculoId) {
    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: nuevoVehiculoId } });
    if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
    if (vehiculo.sucursalId !== sucursalOrigen) throw new AppError("No puedes mover la reserva a un vehículo de otra sucursal", 403);
    if (vehiculo.clienteId !== existente.clienteId) throw new AppError("El vehículo no pertenece al cliente de esta reserva", 400);
    if (vehiculo.bloqueado || !vehiculo.estado) throw new AppError("El vehículo está bloqueado o inactivo", 400);
  }
  if (nuevoPuestoId) {
    const puesto = await prisma.puesto.findUnique({ where: { id: nuevoPuestoId } });
    if (!puesto) throw new AppError("Puesto no encontrado", 404);
    if (puesto.sucursalId !== sucursalOrigen) throw new AppError("No puedes mover la reserva a un puesto de otra sucursal", 403);
    if (!puesto.activo || puesto.estado === "MANTENIMIENTO") throw new AppError("El puesto está inactivo o en mantenimiento", 400);
  }

  const reserva = await prisma.$transaction(async (tx) => {
    const vehiculosLocks = [...new Set([existente.vehiculoId, nuevoVehiculoId].filter((v): v is number => v !== null))].sort((a, b) => a - b);
    const puestosLocks = [...new Set([existente.puestoId, nuevoPuestoId].filter((v): v is number => v !== null))].sort((a, b) => a - b);
    for (const vid of vehiculosLocks) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${vid}::integer)) AS advisory_lock`;
    for (const pid of puestosLocks) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${pid}::integer)) AS advisory_lock`;

    const actual = await tx.reserva.findFirst({ where: { id, ...(sucursalId ? { sucursalId } : {}) } });
    if (
      !actual ||
      !["PENDIENTE", "CONFIRMADA"].includes(actual.estado) ||
      actual.updatedAt.getTime() !== existente.updatedAt.getTime()
    ) {
      throw new AppError("La reserva cambió mientras se editaba. Actualiza e inténtalo nuevamente.", 409);
    }

    const finLimite = fin || new Date("9999-12-31T23:59:59.999Z");
    if (nuevoVehiculoId) {
      const [otraReserva, mensualidad, ingreso] = await Promise.all([
        tx.reserva.findFirst({
          where: { id: { not: id }, vehiculoId: nuevoVehiculoId, sucursalId: sucursalOrigen, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            fechaInicio: { lt: finLimite }, OR: [{ fechaFin: null }, { fechaFin: { gte: inicio } }] },
          select: { id: true },
        }),
        tx.mensualidad.findFirst({
          where: { vehiculoId: nuevoVehiculoId, estado: "ACTIVA", fechaInicio: { lt: finLimite }, fechaFin: { gte: inicio } },
          select: { id: true },
        }),
        tx.ingreso.findFirst({ where: { vehiculoId: nuevoVehiculoId, vehiculo: { sucursalId: sucursalOrigen }, estado: "ACTIVO" }, select: { id: true } }),
      ]);
      if (otraReserva) throw new AppError("El vehículo ya tiene otra reserva en ese periodo", 409);
      if (mensualidad) throw new AppError("El vehículo tiene una mensualidad que se cruza con ese periodo", 409);
      if (ingreso) throw new AppError("El vehículo ya tiene un ingreso activo", 409);
    }
    if (nuevoPuestoId) {
      const [otraReserva, mensualidad, ingreso] = await Promise.all([
        tx.reserva.findFirst({
          where: { id: { not: id }, puestoId: nuevoPuestoId, sucursalId: sucursalOrigen, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            fechaInicio: { lt: finLimite }, OR: [{ fechaFin: null }, { fechaFin: { gte: inicio } }] },
          select: { id: true },
        }),
        tx.mensualidad.findFirst({
          where: { puestoId: nuevoPuestoId, estado: "ACTIVA", fechaInicio: { lt: finLimite }, fechaFin: { gte: inicio } },
          select: { id: true },
        }),
        tx.ingreso.findFirst({ where: { puestoId: nuevoPuestoId, vehiculo: { sucursalId: sucursalOrigen }, estado: "ACTIVO" }, select: { id: true } }),
      ]);
      if (otraReserva || mensualidad || ingreso) throw new AppError("El puesto tiene otra ocupación o asignación en ese periodo", 409);
      const puesto = await tx.puesto.findUnique({ where: { id: nuevoPuestoId } });
      if (!puesto?.activo || puesto.estado === "MANTENIMIENTO" || (puesto.estado !== "LIBRE" && nuevoPuestoId !== existente.puestoId)) {
        throw new AppError("El puesto no está disponible", 409);
      }
    }

    const actualizada = await tx.reserva.update({
      where: { id },
      data: {
        ...(estado !== undefined ? { estado } : {}),
        vehiculoId: nuevoVehiculoId,
        puestoId: nuevoPuestoId,
        fechaInicio: inicio,
        fechaFin: fin,
        ...(observaciones !== undefined ? { observaciones } : {}),
      },
      include: { cliente: true, vehiculo: true, puesto: true },
    });

    if (existente.puestoId && existente.puestoId !== nuevoPuestoId) {
      const ahora = new Date();
      const [ingresoActivo, mensualidadVigente, reservaVigente] = await Promise.all([
        tx.ingreso.count({ where: { puestoId: existente.puestoId, estado: "ACTIVO" } }),
        tx.mensualidad.count({ where: { puestoId: existente.puestoId, estado: "ACTIVA", fechaFin: { gte: ahora } } }),
        tx.reserva.count({ where: { puestoId: existente.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] } }),
      ]);
      const estadoPuesto = ingresoActivo ? "OCUPADO" : mensualidadVigente + reservaVigente ? "RESERVADO" : "LIBRE";
      await tx.puesto.update({ where: { id: existente.puestoId }, data: { estado: estadoPuesto } });
    }
    if (nuevoPuestoId && nuevoPuestoId !== existente.puestoId) {
      await tx.puesto.update({ where: { id: nuevoPuestoId }, data: { estado: "RESERVADO" } });
    }
    return actualizada;
  });
  await registrarMovimiento("RESERVAS", "ACTUALIZAR", `Reserva #${id} actualizada`, req.usuario?.usuario);
  emitirEvento("reserva:actualizada", { mensaje: `Reserva #${id} actualizada`, reserva });
  res.json({ ok: true, reserva });
});


export const cambiarEstado = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { estado } = req.body;
  if (!ESTADOS.includes(estado)) throw new AppError(`Estado inválido. Válidos: ${ESTADOS.join(", ")}`, 400);

  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const reservaInicial = await prisma.reserva.findFirst({ where: { id, ...(sucursalId ? { sucursalId } : {}) } });
  if (!reservaInicial) throw new AppError("Reserva no encontrada", 404);

  const reserva = await prisma.$transaction(async (tx) => {
    if (reservaInicial.vehiculoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${reservaInicial.vehiculoId}::integer)) AS advisory_lock`;
    if (reservaInicial.puestoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${reservaInicial.puestoId}::integer)) AS advisory_lock`;
    const actual = await tx.reserva.findFirst({ where: { id, ...(sucursalId ? { sucursalId } : {}) } });
    if (!actual || actual.vehiculoId !== reservaInicial.vehiculoId || actual.puestoId !== reservaInicial.puestoId) {
      throw new AppError("La reserva cambió mientras se procesaba. Actualiza e inténtalo nuevamente.", 409);
    }
    if (["FINALIZADA", "CANCELADA", "NO_SHOW"].includes(actual.estado)) throw new AppError("La reserva ya está cerrada", 409);
    if (actual.estado === estado) throw new AppError("La reserva ya tiene ese estado", 409);

    if (estado === "CONFIRMADA") {
      if (actual.estado !== "PENDIENTE") throw new AppError("Solo se puede confirmar una reserva pendiente", 409);
      if (actual.puestoId) {
        const puesto = await tx.puesto.findUnique({ where: { id: actual.puestoId } });
        if (!puesto?.activo || puesto.estado === "MANTENIMIENTO" || puesto.estado === "OCUPADO") {
          throw new AppError("El puesto no está disponible para confirmar la reserva", 409);
        }
        await tx.puesto.update({ where: { id: actual.puestoId }, data: { estado: "RESERVADO" } });
      }
      await tx.reserva.update({ where: { id }, data: { estado } });
    } else if (estado === "ACTIVA") {
      if (!["PENDIENTE", "CONFIRMADA"].includes(actual.estado)) throw new AppError("La reserva no puede activarse desde su estado actual", 409);
      if (!actual.puestoId || !actual.vehiculoId) throw new AppError("Debe asignar un puesto y un vehículo antes de activar la reserva", 400);
      const ahora = new Date();
      if (actual.fechaInicio > ahora || (actual.fechaFin && actual.fechaFin < ahora)) {
        throw new AppError("La reserva solo puede activarse dentro de su horario vigente", 409);
      }
      const [puesto, vehiculo, ingresoVehiculo, ingresoPuesto, mensualidad, otraReserva] = await Promise.all([
        tx.puesto.findUnique({ where: { id: actual.puestoId } }),
        tx.vehiculo.findUnique({ where: { id: actual.vehiculoId } }),
        tx.ingreso.findFirst({ where: { vehiculoId: actual.vehiculoId, estado: "ACTIVO" }, select: { id: true } }),
        tx.ingreso.findFirst({ where: { puestoId: actual.puestoId, estado: "ACTIVO" }, select: { id: true } }),
        tx.mensualidad.findFirst({ where: { vehiculoId: actual.vehiculoId, estado: "ACTIVA", fechaInicio: { lte: ahora }, fechaFin: { gte: ahora } }, select: { id: true } }),
        tx.reserva.findFirst({ where: { id: { not: id }, puestoId: actual.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
          fechaInicio: { lte: ahora }, OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] }, select: { id: true } }),
      ]);
      if (!puesto?.activo || puesto.estado === "MANTENIMIENTO") throw new AppError("El puesto no está disponible", 409);
      if (!vehiculo || vehiculo.clienteId !== actual.clienteId || vehiculo.bloqueado || !vehiculo.estado) {
        throw new AppError("El vehículo está inactivo, bloqueado o no pertenece al cliente de la reserva", 409);
      }
      if (ingresoVehiculo || ingresoPuesto || mensualidad || otraReserva) {
        throw new AppError("El vehículo o el puesto tiene otra ocupación o asignación vigente", 409);
      }
      const asignado = await tx.puesto.updateMany({
        where: { id: actual.puestoId, activo: true, estado: { in: ["LIBRE", "RESERVADO"] } },
        data: { estado: "OCUPADO" },
      });
      if (asignado.count !== 1) throw new AppError("El puesto ya fue asignado. Actualiza la disponibilidad.", 409);
      await tx.reserva.update({ where: { id }, data: { estado } });
      await tx.ingreso.create({
        data: { clienteId: actual.clienteId, vehiculoId: actual.vehiculoId, puestoId: actual.puestoId, reservaId: actual.id, fechaEntrada: ahora },
      });
    } else if (estado === "CANCELADA" || estado === "NO_SHOW") {
      if (!["PENDIENTE", "CONFIRMADA"].includes(actual.estado)) {
        throw new AppError("Una reserva activa debe finalizarse mediante el proceso de salida", 409);
      }
      await tx.reserva.update({ where: { id }, data: { estado } });
      if (actual.puestoId) {
        const ahora = new Date();
        const [ingresoActivo, mensualidadVigente, reservaVigente] = await Promise.all([
          tx.ingreso.count({ where: { puestoId: actual.puestoId, estado: "ACTIVO" } }),
          tx.mensualidad.count({ where: { puestoId: actual.puestoId, estado: "ACTIVA", fechaFin: { gte: ahora } } }),
          tx.reserva.count({ where: { puestoId: actual.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, id: { not: id },
            OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] } }),
        ]);
        const estadoPuesto = ingresoActivo > 0 ? "OCUPADO" : mensualidadVigente + reservaVigente > 0 ? "RESERVADO" : "LIBRE";
        await tx.puesto.update({ where: { id: actual.puestoId }, data: { estado: estadoPuesto } });
      }
    } else if (estado === "FINALIZADA") {
      if (actual.estado !== "ACTIVA") throw new AppError("Solo se puede finalizar una reserva activa", 409);
      const ingreso = await tx.ingreso.findFirst({ where: { reservaId: id } });
      if (!ingreso || ingreso.estado === "ACTIVO") {
        throw new AppError("Registre primero la salida y el cobro del ingreso asociado", 409);
      }
      await tx.reserva.update({ where: { id }, data: { estado } });
      if (actual.puestoId) {
        const ahora = new Date();
        const [ingresoActivo, mensualidadVigente, reservaVigente] = await Promise.all([
          tx.ingreso.count({ where: { puestoId: actual.puestoId, estado: "ACTIVO" } }),
          tx.mensualidad.count({ where: { puestoId: actual.puestoId, estado: "ACTIVA", fechaFin: { gte: ahora } } }),
          tx.reserva.count({ where: { puestoId: actual.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, id: { not: id },
            OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] } }),
        ]);
        const estadoPuesto = ingresoActivo > 0 ? "OCUPADO" : mensualidadVigente + reservaVigente > 0 ? "RESERVADO" : "LIBRE";
        await tx.puesto.update({ where: { id: actual.puestoId }, data: { estado: estadoPuesto } });
      }
    } else {
      throw new AppError("Transición de estado no permitida", 400);
    }

    return tx.reserva.findUniqueOrThrow({
      where: { id },
      include: { cliente: true, vehiculo: true, puesto: true },
    });
  });

  if (estado === "ACTIVA") {
    await registrarMovimiento("INGRESOS", "ENTRADA", `Reserva #${id} activada — ingreso creado para puesto ${reserva.puesto?.codigo}`, req.usuario?.usuario);
  }
  await registrarMovimiento("RESERVAS", "ESTADO", `Reserva #${id} → ${estado}`, req.usuario?.usuario);
  emitirEvento("reserva:estado", { mensaje: `Reserva #${id} cambió a ${estado}`, reserva });
  res.json({ ok: true, reserva });
});


export const cancelarReserva = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const existente = await prisma.reserva.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) } });
  if (!existente) throw new AppError("Reserva no encontrada", 404);
  if (["FINALIZADA", "CANCELADA", "NO_SHOW"].includes(existente.estado)) {
    throw new AppError(`La reserva ya está ${existente.estado.toLowerCase()}`, 400);
  }

  const reserva = await prisma.$transaction(async (tx) => {
    const actual = await tx.reserva.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) } });
    if (!actual) throw new AppError("Reserva no encontrada", 404);
    if (actual.vehiculoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${actual.vehiculoId}::integer)) AS advisory_lock`;
    if (actual.puestoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${actual.puestoId}::integer)) AS advisory_lock`;
    const bloqueada = await tx.reserva.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) } });
    if (!bloqueada || bloqueada.vehiculoId !== actual.vehiculoId || bloqueada.puestoId !== actual.puestoId) {
      throw new AppError("La reserva cambió mientras se cancelaba. Actualiza e inténtalo nuevamente.", 409);
    }
    if (["FINALIZADA", "CANCELADA", "NO_SHOW"].includes(bloqueada.estado)) {
      throw new AppError(`La reserva ya está ${bloqueada.estado.toLowerCase()}`, 409);
    }
    if (bloqueada.estado === "ACTIVA") throw new AppError("La reserva ya generó un ingreso; registre la salida antes de cancelarla", 409);
    const cancelada = await tx.reserva.updateMany({
      where: { id: Number(id), estado: bloqueada.estado },
      data: { estado: "CANCELADA" },
    });
    if (cancelada.count !== 1) throw new AppError("La reserva cambió mientras se cancelaba", 409);
    if (bloqueada.puestoId) {
      const ahora = new Date();
      const [ingresoActivo, mensualidadVigente, reservaVigente] = await Promise.all([
        tx.ingreso.count({ where: { puestoId: bloqueada.puestoId, estado: "ACTIVO" } }),
        tx.mensualidad.count({ where: { puestoId: bloqueada.puestoId, estado: "ACTIVA", fechaFin: { gte: ahora } } }),
        tx.reserva.count({ where: { puestoId: bloqueada.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] } }),
      ]);
      const estadoPuesto = ingresoActivo > 0 ? "OCUPADO" : mensualidadVigente + reservaVigente > 0 ? "RESERVADO" : "LIBRE";
      await tx.puesto.update({ where: { id: bloqueada.puestoId }, data: { estado: estadoPuesto } });
    }
    return tx.reserva.findFirstOrThrow({
      where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) },
      include: { cliente: true, vehiculo: true, puesto: true },
    });
  });
  await registrarMovimiento("RESERVAS", "CANCELAR", `Reserva #${id} cancelada — ${reserva.cliente?.nombres}`, req.usuario?.usuario);
  emitirEvento("reserva:cancelada", { mensaje: `Reserva #${id} cancelada`, reserva });
  res.json({ ok: true, reserva });
});

export const eliminarReserva = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const existente = await prisma.reserva.findFirst({ where: { id, ...(sucursalId ? { sucursalId } : {}) } });
  if (!existente) throw new AppError("Reserva no encontrada", 404);
  if (existente.estado === "ACTIVA") throw new AppError("No se puede eliminar una reserva activa; registre primero la salida", 409);

  await prisma.$transaction(async (tx) => {
    if (existente.vehiculoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${existente.vehiculoId}::integer)) AS advisory_lock`;
    if (existente.puestoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${existente.puestoId}::integer)) AS advisory_lock`;
    const actual = await tx.reserva.findFirst({ where: { id, ...(sucursalId ? { sucursalId } : {}) } });
    if (!actual || actual.vehiculoId !== existente.vehiculoId || actual.puestoId !== existente.puestoId) {
      throw new AppError("La reserva cambió mientras se eliminaba. Actualiza e inténtalo nuevamente.", 409);
    }
    if (actual.estado === "ACTIVA") throw new AppError("No se puede eliminar una reserva activa", 409);
    await tx.reserva.delete({ where: { id } });
    if (actual.puestoId) {
      const ahora = new Date();
      const [ingresos, mensualidades, reservas] = await Promise.all([
        tx.ingreso.count({ where: { puestoId: actual.puestoId, estado: "ACTIVO" } }),
        tx.mensualidad.count({ where: { puestoId: actual.puestoId, estado: "ACTIVA", fechaFin: { gte: ahora } } }),
        tx.reserva.count({ where: { puestoId: actual.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
          OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] } }),
      ]);
      const estadoPuesto = ingresos > 0 ? "OCUPADO" : mensualidades + reservas > 0 ? "RESERVADO" : "LIBRE";
      await tx.puesto.update({ where: { id: actual.puestoId }, data: { estado: estadoPuesto } });
    }
  });
  await registrarMovimiento("RESERVAS", "ELIMINAR", `Reserva #${id} eliminada`, req.usuario?.usuario);
  emitirEvento("reserva:eliminada", { mensaje: `Reserva #${id} eliminada` });
  res.json({ ok: true, message: "Reserva eliminada" });
});


export const liberarReservasVencidas = asyncHandler(async (req, res) => {
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const ahora = new Date();
  const vencidas = await prisma.reserva.findMany({
    where: { ...(sucursalId ? { sucursalId } : {}), estado: { in: ["PENDIENTE", "CONFIRMADA"] }, fechaInicio: { lt: ahora } },
    include: { cliente: true },
  });

  let liberadas = 0;
  for (const reserva of vencidas) {
    const limiteLlegada = reserva.fechaFin ?? new Date(reserva.fechaInicio.getTime() + 60 * 60 * 1000);
    if (limiteLlegada > ahora) continue;

    const cambio = await prisma.$transaction(async (tx) => {
      if (reserva.vehiculoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${reserva.vehiculoId}::integer)) AS advisory_lock`;
      if (reserva.puestoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${reserva.puestoId}::integer)) AS advisory_lock`;
      const actual = await tx.reserva.findFirst({ where: { id: reserva.id, ...(sucursalId ? { sucursalId } : {}) } });
      if (!actual || actual.vehiculoId !== reserva.vehiculoId || actual.puestoId !== reserva.puestoId) return false;
      if (!["PENDIENTE", "CONFIRMADA"].includes(actual.estado)) return false;
      const limiteActual = actual.fechaFin ?? new Date(actual.fechaInicio.getTime() + 60 * 60 * 1000);
      if (actual.fechaInicio >= ahora || limiteActual > ahora) return false;
      const actualizada = await tx.reserva.updateMany({
        where: { id: actual.id, estado: actual.estado, fechaInicio: actual.fechaInicio, fechaFin: actual.fechaFin },
        data: { estado: actual.estado === "CONFIRMADA" ? "NO_SHOW" : "CANCELADA" },
      });
      if (actualizada.count !== 1) return false;
      if (actual.puestoId) {
        const [ingresoActivo, mensualidadVigente, reservaVigente] = await Promise.all([
          tx.ingreso.count({ where: { puestoId: actual.puestoId, estado: "ACTIVO" } }),
          tx.mensualidad.count({ where: { puestoId: actual.puestoId, estado: "ACTIVA", fechaFin: { gte: ahora } } }),
          tx.reserva.count({ where: { puestoId: actual.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, id: { not: actual.id }, OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] } }),
        ]);
        const estadoPuesto = ingresoActivo > 0 ? "OCUPADO" : mensualidadVigente + reservaVigente > 0 ? "RESERVADO" : "LIBRE";
        await tx.puesto.update({ where: { id: actual.puestoId }, data: { estado: estadoPuesto } });
      }
      return true;
    });
    if (!cambio) continue;
    await registrarMovimiento("RESERVAS", "VENCER", `Reserva #${reserva.id} vencida — ${reserva.cliente?.nombres}`, "sistema");
    liberadas++;
  }

  res.json({ ok: true, liberadas, message: `${liberadas} reserva(s) liberada(s)` });
});

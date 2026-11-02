import prisma from "../../config/prisma.js";
import type { Prisma } from "@prisma/client";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { emitirEvento } from "../../services/socket.js";

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
    if (vehiculo.clienteId !== cid) throw new AppError("El vehículo no pertenece al cliente seleccionado", 400);
    if (vehiculo.bloqueado) throw new AppError("El vehículo está bloqueado", 400);
    if (!vehiculo.estado) throw new AppError("El vehículo está inactivo", 400);
  }

  let puesto = null;
  if (pid) {
    puesto = await prisma.puesto.findUnique({ where: { id: pid } });
    if (!puesto) throw new AppError("Puesto no encontrado", 404);
    if (!puesto.activo) throw new AppError("El puesto está inactivo", 400);
    if (puesto.estado === "MANTENIMIENTO") throw new AppError("El puesto está en mantenimiento", 400);
    if (puesto.estado === "OCUPADO") throw new AppError("El puesto está ocupado", 400);
  }

  if (vid) {
    const duplicado = await prisma.reserva.findFirst({
      where: {
        vehiculoId: vid,
        estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
      },
    });
    if (duplicado) throw new AppError("El vehículo ya tiene una reserva activa (pendiente, confirmada o activa)", 400);
  }

  const fin = fechaFin ? new Date(fechaFin) : null;
  if (fechaFin && (!fin || !Number.isFinite(fin.getTime()))) throw new AppError("La fecha fin no es válida", 400);
  if (fin && fin <= inicio) throw new AppError("La fecha fin debe ser posterior a la fecha inicio", 400);

  if (pid) {
    const conflicto = await prisma.reserva.findFirst({
      where: {
        puestoId: pid,
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
          where: { vehiculoId: vid, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            fechaInicio: { lt: finLimite }, OR: [{ fechaFin: null }, { fechaFin: { gte: inicio } }] },
          select: { id: true },
        }),
        tx.mensualidad.findFirst({
          where: { vehiculoId: vid, estado: "ACTIVA", fechaInicio: { lt: finLimite }, fechaFin: { gte: inicio } },
          select: { id: true },
        }),
        tx.ingreso.findFirst({ where: { vehiculoId: vid, estado: "ACTIVO" }, select: { id: true } }),
      ]);
      if (reservaVehiculo) throw new AppError("El vehículo ya tiene una reserva en ese periodo", 409);
      if (mensualidadVehiculo) throw new AppError("El vehículo tiene una mensualidad que se cruza con ese periodo", 409);
      if (ingresoVehiculo) throw new AppError("El vehículo ya tiene un ingreso activo", 409);
    }
    if (pid) {
      const [conflictoPuesto, mensualidadPuesto, ingresoPuesto] = await Promise.all([
        tx.reserva.findFirst({
          where: { puestoId: pid, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            fechaInicio: { lt: finLimite }, OR: [{ fechaFin: null }, { fechaFin: { gte: inicio } }] },
          select: { id: true },
        }),
        tx.mensualidad.findFirst({
          where: { puestoId: pid, estado: "ACTIVA", fechaInicio: { lt: finLimite }, fechaFin: { gte: inicio } },
          select: { id: true },
        }),
        tx.ingreso.findFirst({ where: { puestoId: pid, estado: "ACTIVO" }, select: { id: true } }),
      ]);
      if (conflictoPuesto || mensualidadPuesto || ingresoPuesto) {
        throw new AppError("El puesto tiene otra ocupación o asignación en ese periodo", 409);
      }
    }

    return tx.reserva.create({
      data: { clienteId: cid, vehiculoId: vid, puestoId: pid, fechaInicio: inicio, fechaFin: fin, observaciones },
      include: { cliente: true, vehiculo: true, puesto: true },
    });
  });
  const codPuesto = puesto?.codigo || "sin asignar";
  await registrarMovimiento("RESERVAS", "CREAR", `Reserva #${reserva.id} — ${cliente.nombres} → puesto ${codPuesto}`, req.usuario?.usuario);
  emitirEvento("reserva:creada", { mensaje: `Nueva reserva de ${cliente.nombres} para puesto ${codPuesto}`, reserva });
  res.status(201).json({ ok: true, reserva });
});

export const obtenerReservas = asyncHandler(async (req, res) => {
  const { page, limit, estado, clienteId, puestoId, desde, hasta, q } = req.query;
  const where: Prisma.ReservaWhereInput = {};
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
  const reserva = await prisma.reserva.findUnique({
    where: { id: Number(id) },
    include: { cliente: true, vehiculo: true, puesto: true },
  });
  if (!reserva) throw new AppError("Reserva no encontrada", 404);
  res.json({ ok: true, reserva });
});

export const actualizarReserva = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { estado, vehiculoId, puestoId, fechaInicio, fechaFin, observaciones } = req.body;
  const existente = await prisma.reserva.findUnique({ where: { id } });
  if (!existente) throw new AppError("Reserva no encontrada", 404);
  if (["FINALIZADA", "CANCELADA", "NO_SHOW", "ACTIVA"].includes(existente.estado)) {
    throw new AppError("Solo se pueden editar reservas pendientes o confirmadas", 409);
  }
  if (estado !== undefined && !["PENDIENTE", "CONFIRMADA"].includes(estado)) {
    throw new AppError("Para activar, finalizar o cancelar utilice la acción de cambio de estado", 400);
  }

  const nuevoVehiculoId = vehiculoId !== undefined ? (vehiculoId ? Number(vehiculoId) : null) : existente.vehiculoId;
  const nuevoPuestoId = puestoId !== undefined ? (puestoId ? Number(puestoId) : null) : existente.puestoId;
  const inicio = fechaInicio !== undefined ? new Date(fechaInicio) : existente.fechaInicio;
  const fin = fechaFin !== undefined ? (fechaFin ? new Date(fechaFin) : null) : existente.fechaFin;
  if (!Number.isFinite(inicio.getTime())) throw new AppError("La fecha de inicio no es válida", 400);
  if (fechaFin && (!fin || !Number.isFinite(fin.getTime()))) throw new AppError("La fecha fin no es válida", 400);
  if (fin && fin <= inicio) throw new AppError("La fecha fin debe ser posterior a la fecha inicio", 400);

  if (nuevoVehiculoId) {
    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: nuevoVehiculoId } });
    if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
    if (vehiculo.clienteId !== existente.clienteId) throw new AppError("El vehículo no pertenece al cliente de esta reserva", 400);
    if (vehiculo.bloqueado || !vehiculo.estado) throw new AppError("El vehículo está bloqueado o inactivo", 400);
  }
  if (nuevoPuestoId) {
    const puesto = await prisma.puesto.findUnique({ where: { id: nuevoPuestoId } });
    if (!puesto) throw new AppError("Puesto no encontrado", 404);
    if (!puesto.activo || puesto.estado === "MANTENIMIENTO") throw new AppError("El puesto está inactivo o en mantenimiento", 400);
  }

  const reserva = await prisma.$transaction(async (tx) => {
    const vehiculosLocks = [...new Set([existente.vehiculoId, nuevoVehiculoId].filter((v): v is number => v !== null))].sort((a, b) => a - b);
    const puestosLocks = [...new Set([existente.puestoId, nuevoPuestoId].filter((v): v is number => v !== null))].sort((a, b) => a - b);
    for (const vid of vehiculosLocks) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${vid}::integer)) AS advisory_lock`;
    for (const pid of puestosLocks) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${pid}::integer)) AS advisory_lock`;

    const actual = await tx.reserva.findUnique({ where: { id } });
    if (!actual || !["PENDIENTE", "CONFIRMADA"].includes(actual.estado)) throw new AppError("La reserva cambió y ya no se puede editar", 409);

    const finLimite = fin || new Date("9999-12-31T23:59:59.999Z");
    if (nuevoVehiculoId) {
      const [otraReserva, mensualidad, ingreso] = await Promise.all([
        tx.reserva.findFirst({
          where: { id: { not: id }, vehiculoId: nuevoVehiculoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            fechaInicio: { lt: finLimite }, OR: [{ fechaFin: null }, { fechaFin: { gte: inicio } }] },
          select: { id: true },
        }),
        tx.mensualidad.findFirst({
          where: { vehiculoId: nuevoVehiculoId, estado: "ACTIVA", fechaInicio: { lt: finLimite }, fechaFin: { gte: inicio } },
          select: { id: true },
        }),
        tx.ingreso.findFirst({ where: { vehiculoId: nuevoVehiculoId, estado: "ACTIVO" }, select: { id: true } }),
      ]);
      if (otraReserva) throw new AppError("El vehículo ya tiene otra reserva en ese periodo", 409);
      if (mensualidad) throw new AppError("El vehículo tiene una mensualidad que se cruza con ese periodo", 409);
      if (ingreso) throw new AppError("El vehículo ya tiene un ingreso activo", 409);
    }
    if (nuevoPuestoId) {
      const [otraReserva, mensualidad, ingreso] = await Promise.all([
        tx.reserva.findFirst({
          where: { id: { not: id }, puestoId: nuevoPuestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            fechaInicio: { lt: finLimite }, OR: [{ fechaFin: null }, { fechaFin: { gte: inicio } }] },
          select: { id: true },
        }),
        tx.mensualidad.findFirst({
          where: { puestoId: nuevoPuestoId, estado: "ACTIVA", fechaInicio: { lt: finLimite }, fechaFin: { gte: inicio } },
          select: { id: true },
        }),
        tx.ingreso.findFirst({ where: { puestoId: nuevoPuestoId, estado: "ACTIVO" }, select: { id: true } }),
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
  const { id } = req.params;
  const { estado } = req.body;
  if (!ESTADOS.includes(estado)) throw new AppError(`Estado inválido. Válidos: ${ESTADOS.join(", ")}`, 400);

  const existente = await prisma.reserva.findUnique({ where: { id: Number(id) } });
  if (!existente) throw new AppError("Reserva no encontrada", 404);

  const reserva = await prisma.$transaction(async (tx) => {
    if (existente.vehiculoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${existente.vehiculoId}::integer)) AS advisory_lock`;
    if (existente.puestoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${existente.puestoId}::integer)) AS advisory_lock`;
    const reservaActual = await tx.reserva.findUnique({ where: { id: Number(id) } });
    if (!reservaActual || reservaActual.vehiculoId !== existente.vehiculoId || reservaActual.puestoId !== existente.puestoId) {
      throw new AppError("La reserva cambió mientras se procesaba. Actualiza e inténtalo nuevamente.", 409);
    }
    if (["FINALIZADA", "CANCELADA", "NO_SHOW"].includes(reservaActual.estado)) throw new AppError("La reserva ya está cerrada", 409);
    if (reservaActual.estado === "ACTIVA" && estado === "ACTIVA") throw new AppError("La reserva ya está activa", 409);
      if (actual.fechaInicio > ahora || (actual.fechaFin && actual.fechaFin < ahora)) {
        throw new AppError("La reserva solo puede activarse dentro de su horario vigente", 409);
      }

      const puesto = await tx.puesto.findUnique({ where: { id: existente.puestoId } });
      if (!puesto) throw new AppError("Puesto no encontrado", 404);
      if (!puesto.activo) throw new AppError("El puesto está inactivo", 400);
      const [ingresoYaActivo, ingresoEnPuesto, mensualidadEnPuesto, otraReserva] = await Promise.all([
        tx.ingreso.findFirst({ where: { vehiculoId: existente.vehiculoId, estado: "ACTIVO" }, select: { id: true } }),
        tx.ingreso.findFirst({ where: { puestoId: existente.puestoId, estado: "ACTIVO" }, select: { id: true } }),
        tx.mensualidad.findFirst({
          where: {
            puestoId: existente.puestoId,
            estado: "ACTIVA",
            fechaInicio: { lte: ahora },
            fechaFin: { gte: ahora },
          },
          select: { id: true },
        }),
        tx.reserva.findFirst({
          where: {
            id: { not: Number(id) },
            puestoId: existente.puestoId,
            estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            fechaInicio: { lte: ahora },
            OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }],
          },
          select: { id: true },
        }),
      ]);
      if (ingresoYaActivo) throw new AppError("El vehículo ya tiene un ingreso activo", 409);
      if (ingresoEnPuesto || mensualidadEnPuesto || otraReserva) {
        throw new AppError("El puesto tiene otra ocupación, mensualidad o reserva vigente", 409);
      }

      const asignado = await tx.puesto.updateMany({
        where: { id: existente.puestoId, activo: true, estado: { in: ["LIBRE", "RESERVADO"] } },
        data: { estado: "OCUPADO" },
      });
      if (asignado.count !== 1) throw new AppError("El puesto ya fue asignado. Actualiza la disponibilidad.", 409);

      await tx.reserva.update({ where: { id: Number(id) }, data: { estado } });
      await tx.ingreso.create({
        data: {
          clienteId: existente.clienteId,
          vehiculoId: existente.vehiculoId,
          puestoId: existente.puestoId,
          reservaId: reservaActual.id,
          fechaEntrada: ahora,
        },
      });
    } else {
      await tx.reserva.update({
        where: { id: Number(id) },
        data: { estado },
      });
    }

    if (estado === "FINALIZADA" && reservaActual.puestoId) {
      const ingresoAsociado = await tx.ingreso.findFirst({ where: { reservaId: existente.id, estado: "ACTIVO" } });
      if (ingresoAsociado) {
        const fechaSalida = new Date();
        const tiempoMinutos = Math.ceil((fechaSalida.getTime() - new Date(ingresoAsociado.fechaEntrada).getTime()) / (1000 * 60));
        await tx.ingreso.update({
          where: { id: ingresoAsociado.id },
          data: { estado: "FINALIZADO", fechaSalida, tiempoMinutos },
        });
      }
      const ingresoActivo = await tx.ingreso.count({ where: { puestoId: existente.puestoId, estado: "ACTIVO" } });
      const otraMensualidad = await tx.mensualidad.count({ where: { puestoId: existente.puestoId, estado: "ACTIVA" } });
      const otraReserva = await tx.reserva.count({ where: { puestoId: existente.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, id: { not: Number(id) } } });
      if (ingresoActivo === 0 && otraMensualidad === 0 && otraReserva === 0) {
        await tx.puesto.update({ where: { id: existente.puestoId }, data: { estado: "LIBRE" } });
      }
    }

    if (["CANCELADA", "NO_SHOW"].includes(estado) && reservaActual.puestoId) {
      const ingresoActivo = await tx.ingreso.count({ where: { puestoId: existente.puestoId, estado: "ACTIVO" } });
      const otraMensualidad = await tx.mensualidad.count({ where: { puestoId: existente.puestoId, estado: "ACTIVA" } });
      const otraReserva = await tx.reserva.count({ where: { puestoId: existente.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, id: { not: Number(id) } } });
      if (ingresoActivo === 0 && otraMensualidad === 0 && otraReserva === 0) {
        await tx.puesto.update({ where: { id: existente.puestoId }, data: { estado: "LIBRE" } });
      }
    }

    if (estado === "CONFIRMADA" && reservaActual.puestoId) {
      await tx.puesto.update({ where: { id: existente.puestoId }, data: { estado: "RESERVADO" } });
    }

    return tx.reserva.findUniqueOrThrow({
      where: { id: Number(id) },
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
  const existente = await prisma.reserva.findUnique({ where: { id: Number(id) } });
  if (!existente) throw new AppError("Reserva no encontrada", 404);
  if (["FINALIZADA", "CANCELADA", "NO_SHOW"].includes(existente.estado)) {
    throw new AppError(`La reserva ya está ${existente.estado.toLowerCase()}`, 400);
  }

  const reserva = await prisma.$transaction(async (tx) => {
    const actual = await tx.reserva.findUnique({ where: { id: Number(id) } });
    if (!actual) throw new AppError("Reserva no encontrada", 404);
    if (actual.vehiculoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${actual.vehiculoId}::integer)) AS advisory_lock`;
    if (actual.puestoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${actual.puestoId}::integer)) AS advisory_lock`;
    if (["FINALIZADA", "CANCELADA", "NO_SHOW"].includes(actual.estado)) {
      throw new AppError(`La reserva ya está ${actual.estado.toLowerCase()}`, 409);
    }
    if (actual.estado === "ACTIVA") throw new AppError("La reserva ya generó un ingreso; registre la salida antes de cancelarla", 409);
    const cancelada = await tx.reserva.updateMany({
      where: { id: Number(id), estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] } },
      data: { estado: "CANCELADA" },
    });
    if (cancelada.count !== 1) throw new AppError("La reserva cambió mientras se cancelaba", 409);
    if (actual.puestoId) {
      const ahora = new Date();
      const [ingresoActivo, mensualidadVigente, reservaVigente] = await Promise.all([
        tx.ingreso.count({ where: { puestoId: actual.puestoId, estado: "ACTIVO" } }),
        tx.mensualidad.count({ where: { puestoId: actual.puestoId, estado: "ACTIVA", fechaFin: { gte: ahora } } }),
        tx.reserva.count({ where: { puestoId: actual.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] } }),
      ]);
      const estadoPuesto = ingresoActivo > 0 ? "OCUPADO" : mensualidadVigente + reservaVigente > 0 ? "RESERVADO" : "LIBRE";
      await tx.puesto.update({ where: { id: actual.puestoId }, data: { estado: estadoPuesto } });
    }
    return tx.reserva.findUniqueOrThrow({
      where: { id: Number(id) },
      include: { cliente: true, vehiculo: true, puesto: true },
    });
  });
  await registrarMovimiento("RESERVAS", "CANCELAR", `Reserva #${id} cancelada — ${reserva.cliente?.nombres}`, req.usuario?.usuario);
  emitirEvento("reserva:cancelada", { mensaje: `Reserva #${id} cancelada`, reserva });
  res.json({ ok: true, reserva });
});

export const eliminarReserva = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existente = await prisma.reserva.findUnique({ where: { id: Number(id) } });
  if (!existente) throw new AppError("Reserva no encontrada", 404);
  if (existente.estado === "ACTIVA") {
    throw new AppError("No se puede eliminar una reserva activa", 400);
  }
  if (existente.estado !== "CANCELADA" && existente.puestoId) {
    await liberarPuesto(existente.puestoId, req.usuario?.usuario, "eliminada");
  }
  await prisma.reserva.delete({ where: { id: Number(id) } });
  await registrarMovimiento("RESERVAS", "ELIMINAR", `Reserva #${id} eliminada`, req.usuario?.usuario);
  emitirEvento("reserva:eliminada", { mensaje: `Reserva #${id} eliminada` });
  res.json({ ok: true, message: "Reserva eliminada" });
});

export const liberarReservasVencidas = asyncHandler(async (req, res) => {
  const ahora = new Date();
  const vencidas = await prisma.reserva.findMany({
    where: { estado: { in: ["PENDIENTE", "CONFIRMADA"] }, fechaInicio: { lt: ahora } },
    include: { cliente: true },
  });

  let liberadas = 0;
  for (const reserva of vencidas) {
    const limiteLlegada = reserva.fechaFin ?? new Date(reserva.fechaInicio.getTime() + 60 * 60 * 1000);
    if (limiteLlegada > ahora) continue;

    const cambio = await prisma.$transaction(async (tx) => {
      if (reserva.vehiculoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${reserva.vehiculoId}::integer)) AS advisory_lock`;
      if (reserva.puestoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${reserva.puestoId}::integer)) AS advisory_lock`;
      const actualizada = await tx.reserva.updateMany({
        where: { id: reserva.id, estado: { in: ["PENDIENTE", "CONFIRMADA"] } },
        data: { estado: reserva.estado === "CONFIRMADA" ? "NO_SHOW" : "CANCELADA" },
      });
      if (actualizada.count !== 1) return false;
      if (reserva.puestoId) {
        const [ingresoActivo, mensualidadVigente, reservaVigente] = await Promise.all([
          tx.ingreso.count({ where: { puestoId: reserva.puestoId, estado: "ACTIVO" } }),
          tx.mensualidad.count({ where: { puestoId: reserva.puestoId, estado: "ACTIVA", fechaFin: { gte: ahora } } }),
          tx.reserva.count({ where: { puestoId: reserva.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, id: { not: reserva.id }, OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] } }),
        ]);
        const estadoPuesto = ingresoActivo > 0 ? "OCUPADO" : mensualidadVigente + reservaVigente > 0 ? "RESERVADO" : "LIBRE";
        await tx.puesto.update({ where: { id: reserva.puestoId }, data: { estado: estadoPuesto } });
      }
      return true;
    });
    if (!cambio) continue;
    await registrarMovimiento("RESERVAS", "VENCER", `Reserva #${reserva.id} vencida — ${reserva.cliente?.nombres}`, "sistema");
    liberadas++;
  }

  res.json({ ok: true, liberadas, message: `${liberadas} reserva(s) liberada(s)` });
});

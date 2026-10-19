import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { emitirEvento } from "../../services/socket.js";

const ESTADOS = ["PENDIENTE", "CONFIRMADA", "ACTIVA", "FINALIZADA", "CANCELADA", "NO_SHOW"];

async function ocuparPuesto(puestoId, usuario) {
  await prisma.puesto.update({ where: { id: Number(puestoId) }, data: { estado: "RESERVADO" } });
  await registrarMovimiento("PUESTOS", "RESERVAR", `Puesto #${puestoId} reservado`, usuario);
}

async function liberarPuesto(puestoId, usuario, motivo = "liberado") {
  await prisma.puesto.update({ where: { id: Number(puestoId) }, data: { estado: "LIBRE" } });
  await registrarMovimiento("PUESTOS", "LIBERAR", `Puesto #${puestoId} ${motivo}`, usuario);
}

export const crearReserva = asyncHandler(async (req, res) => {
  const { clienteId, vehiculoId, puestoId, fechaInicio, fechaFin, observaciones } = req.body;

  const cid = Number(clienteId);
  const vid = vehiculoId ? Number(vehiculoId) : null;
  const pid = puestoId ? Number(puestoId) : null;

  const inicio = new Date(fechaInicio);
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
  if (fin && fin <= inicio) throw new AppError("La fecha fin debe ser posterior a la fecha inicio", 400);

  if (pid) {
    const conflicto = await prisma.reserva.findFirst({
      where: {
        puestoId: pid,
        estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
        fechaInicio: { lt: fin || new Date(inicio.getTime() + 86400000) },
        ...(fin ? { fechaFin: { gte: inicio } } : { fechaFin: { gte: inicio } }),
      },
    });
    if (conflicto) throw new AppError("El puesto ya tiene una reserva en ese rango de fechas", 409);
  }

  const reserva = await prisma.reserva.create({
    data: { clienteId: cid, vehiculoId: vid, puestoId: pid, fechaInicio: inicio, fechaFin: fin, observaciones },
    include: { cliente: true, vehiculo: true, puesto: true },
  });
  const codPuesto = puesto?.codigo || "sin asignar";
  await registrarMovimiento("RESERVAS", "CREAR", `Reserva #${reserva.id} — ${cliente.nombres} → puesto ${codPuesto}`, req.usuario?.usuario);
  emitirEvento("reserva:creada", { mensaje: `Nueva reserva de ${cliente.nombres} para puesto ${codPuesto}`, reserva });
  res.status(201).json({ ok: true, reserva });
});

export const obtenerReservas = asyncHandler(async (req, res) => {
  const { page, limit, estado, clienteId, puestoId, desde, hasta, q } = req.query;
  const where = {};
  if (estado) where.estado = estado;
  if (clienteId) where.clienteId = Number(clienteId);
  if (puestoId) where.puestoId = Number(puestoId);
  if (desde || hasta) {
    where.fechaInicio = {};
    if (desde) where.fechaInicio.gte = new Date(desde);
    if (hasta) where.fechaInicio.lte = new Date(hasta);
  }
  if (q) {
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
  const { id } = req.params;
  const { estado, vehiculoId, puestoId, fechaInicio, fechaFin, observaciones } = req.body;

  const existente = await prisma.reserva.findUnique({ where: { id: Number(id) } });
  if (!existente) throw new AppError("Reserva no encontrada", 404);
  if (["FINALIZADA", "CANCELADA", "NO_SHOW"].includes(existente.estado)) {
    throw new AppError(`No se puede modificar una reserva ${existente.estado.toLowerCase()}`, 400);
  }

  const cid = existente.clienteId;
  const vid = vehiculoId !== undefined ? (vehiculoId ? Number(vehiculoId) : null) : existente.vehiculoId;

  if (vehiculoId !== undefined && vid) {
    const duplicado = await prisma.reserva.findFirst({
      where: {
        vehiculoId: vid,
        estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
        id: { not: Number(id) },
      },
    });
    if (duplicado) throw new AppError("El vehículo ya tiene una reserva activa (pendiente, confirmada o activa)", 400);
    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vid } });
    if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
    if (vehiculo.clienteId !== cid) throw new AppError("El vehículo no pertenece al cliente de esta reserva", 400);
    if (vehiculo.bloqueado) throw new AppError("El vehículo está bloqueado", 400);
  }

  const data: any = {};
  if (estado && ESTADOS.includes(estado)) data.estado = estado;
  if (vehiculoId !== undefined) data.vehiculoId = vid;
  if (puestoId !== undefined) {
    const nuevoPuesto = puestoId ? Number(puestoId) : null;
    if (existente.puestoId && existente.puestoId !== nuevoPuesto) {
      const ingresoActivo = await prisma.ingreso.count({ where: { puestoId: existente.puestoId, estado: "ACTIVO" } });
      const otraMensualidad = await prisma.mensualidad.count({ where: { puestoId: existente.puestoId, estado: "ACTIVA", id: { not: existente.id } } });
      const otraReserva = await prisma.reserva.count({ where: { puestoId: existente.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, id: { not: Number(id) } } });
      if (ingresoActivo === 0 && otraMensualidad === 0 && otraReserva === 0) {
        await prisma.puesto.update({ where: { id: existente.puestoId }, data: { estado: "LIBRE" } });
      }
    }
    if (nuevoPuesto) {
      const p = await prisma.puesto.findUnique({ where: { id: nuevoPuesto } });
      if (!p) throw new AppError("Puesto no encontrado", 404);
      if (!p.activo) throw new AppError("El puesto está inactivo", 400);
      if (p.estado === "MANTENIMIENTO") throw new AppError("El puesto está en mantenimiento", 400);
      if (p.estado !== "LIBRE") throw new AppError("El nuevo puesto no está disponible (estado: " + p.estado + ")", 400);
    }
    data.puestoId = nuevoPuesto;
  }
  if (fechaInicio) data.fechaInicio = new Date(fechaInicio);
  if (fechaFin !== undefined) data.fechaFin = fechaFin ? new Date(fechaFin) : null;
  if (observaciones !== undefined) data.observaciones = observaciones;

  const reserva = await prisma.reserva.update({
    where: { id: Number(id) }, data,
    include: { cliente: true, vehiculo: true, puesto: true },
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
    await tx.reserva.update({
      where: { id: Number(id) },
      data: { estado },
    });

    if (estado === "ACTIVA") {
      if (!existente.puestoId) throw new AppError("Debe asignar un puesto antes de activar la reserva", 400);
      if (!existente.vehiculoId) throw new AppError("Debe asignar un vehículo antes de activar la reserva", 400);
      const puesto = await tx.puesto.findUnique({ where: { id: existente.puestoId } });
      if (!puesto) throw new AppError("Puesto no encontrado", 404);
      if (!puesto.activo) throw new AppError("El puesto está inactivo", 400);
      if (puesto.estado !== "LIBRE") throw new AppError("El puesto no está disponible (estado: " + puesto.estado + ")", 400);
      const ingresoYaActivo = await tx.ingreso.findFirst({ where: { vehiculoId: existente.vehiculoId, estado: "ACTIVO" } });
      if (ingresoYaActivo) throw new AppError("El vehículo ya tiene un ingreso activo", 400);
      await tx.puesto.update({ where: { id: existente.puestoId }, data: { estado: "OCUPADO" } });
      await tx.ingreso.create({
        data: {
          clienteId: existente.clienteId,
          vehiculoId: existente.vehiculoId,
          puestoId: existente.puestoId,
          reservaId: existente.id,
          fechaEntrada: new Date(),
        },
      });
    }

    if (estado === "FINALIZADA" && existente.puestoId) {
      const ingresoAsociado = await tx.ingreso.findFirst({ where: { reservaId: existente.id, estado: "ACTIVO" } });
      if (ingresoAsociado) {
        const fechaSalida = new Date();
        const tiempoMinutos = Math.ceil((fechaSalida - ingresoAsociado.fechaEntrada) / (1000 * 60));
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

    if (["CANCELADA", "NO_SHOW"].includes(estado) && existente.puestoId) {
      const ingresoActivo = await tx.ingreso.count({ where: { puestoId: existente.puestoId, estado: "ACTIVO" } });
      const otraMensualidad = await tx.mensualidad.count({ where: { puestoId: existente.puestoId, estado: "ACTIVA" } });
      const otraReserva = await tx.reserva.count({ where: { puestoId: existente.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, id: { not: Number(id) } } });
      if (ingresoActivo === 0 && otraMensualidad === 0 && otraReserva === 0) {
        await tx.puesto.update({ where: { id: existente.puestoId }, data: { estado: "LIBRE" } });
      }
    }

    if (estado === "CONFIRMADA" && existente.puestoId) {
      await tx.puesto.update({ where: { id: existente.puestoId }, data: { estado: "RESERVADO" } });
    }

    return tx.reserva.findUnique({
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

  const reserva = await prisma.reserva.update({
    where: { id: Number(id) }, data: { estado: "CANCELADA" },
    include: { cliente: true, vehiculo: true, puesto: true },
  });
  if (reserva.puestoId) {
    const ingresoActivo = await prisma.ingreso.count({ where: { puestoId: reserva.puestoId, estado: "ACTIVO" } });
    const otraMensualidad = await prisma.mensualidad.count({ where: { puestoId: reserva.puestoId, estado: "ACTIVA" } });
    const otraReserva = await prisma.reserva.count({ where: { puestoId: reserva.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, id: { not: Number(id) } } });
    if (ingresoActivo === 0 && otraMensualidad === 0 && otraReserva === 0) {
      await liberarPuesto(reserva.puestoId, req.usuario?.usuario, "cancelada");
    }
  }
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
  const TOLERANCIA_LLEGADA_MS = 60 * 60 * 1000;
  const vencidas = await prisma.reserva.findMany({
    where: {
      estado: { in: ["PENDIENTE", "CONFIRMADA"] },
      fechaInicio: { lt: ahora },
      ...(ahora.getTime() - new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime() > TOLERANCIA_LLEGADA_MS ? {} : {}),
    },
    include: { cliente: true, puesto: true },
  });

  let liberadas = 0;
  for (const r of vencidas) {
    const fechaFin = r.fechaFin ? new Date(r.fechaFin) : null;
    if (fechaFin && fechaFin > ahora) continue;

    await prisma.reserva.update({ where: { id: r.id }, data: { estado: r.estado === "CONFIRMADA" ? "NO_SHOW" : "CANCELADA" } });
    if (r.puestoId) {
      const ingresoActivo = await prisma.ingreso.count({ where: { puestoId: r.puestoId, estado: "ACTIVO" } });
      const otraMensualidad = await prisma.mensualidad.count({ where: { puestoId: r.puestoId, estado: "ACTIVA" } });
      const otraReserva = await prisma.reserva.count({ where: { puestoId: r.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, id: { not: r.id } } });
      if (ingresoActivo === 0 && otraMensualidad === 0 && otraReserva === 0) {
        await liberarPuesto(r.puestoId, "sistema", `reserva #${r.id} vencida`);
      }
    }
    await registrarMovimiento("RESERVAS", "VENCER", `Reserva #${r.id} vencida — ${r.cliente?.nombres}`, "sistema");
    liberadas++;
  }

  res.json({ ok: true, liberadas, message: `${liberadas} reserva(s) liberada(s)` });
});

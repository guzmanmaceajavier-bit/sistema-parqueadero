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

  const inicio = new Date(fechaInicio);
  const MARGEN_MS = 5 * 60 * 1000;
  if (inicio.getTime() < Date.now() - MARGEN_MS) throw new AppError("La fecha de inicio debe ser futura", 400);

  const [cliente, vehiculo, puesto] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: Number(clienteId) } }),
    vehiculoId ? prisma.vehiculo.findUnique({ where: { id: Number(vehiculoId) } }) : Promise.resolve(null),
    puestoId ? prisma.puesto.findUnique({ where: { id: Number(puestoId) } }) : Promise.resolve(null),
  ]);
  if (!cliente) throw new AppError("Cliente no encontrado", 404);
  if (vehiculoId && !vehiculo) throw new AppError("Vehículo no encontrado", 404);
  if (puestoId && !puesto) throw new AppError("Puesto no encontrado", 404);
  if (puesto && puesto.estado === "MANTENIMIENTO") throw new AppError("El puesto está en mantenimiento", 400);
  if (puesto && puesto.estado === "OCUPADO") throw new AppError("El puesto está ocupado", 400);

  if (vehiculoId) {
    const duplicado = await prisma.reserva.findFirst({
      where: {
        vehiculoId: Number(vehiculoId),
        estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
        id: { not: req.body._id ? Number(req.body._id) : undefined },
      },
    });
    if (duplicado) throw new AppError("El vehículo ya tiene una reserva activa (pendiente, confirmada o activa)", 400);
  }

  const fin = fechaFin ? new Date(fechaFin) : null;
  if (fin && fin <= inicio) throw new AppError("La fecha fin debe ser posterior a la fecha inicio", 400);

  if (puestoId) {
    const conflicto = await prisma.reserva.findFirst({
      where: {
        puestoId: Number(puestoId),
        estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
        fechaInicio: { lt: fin || new Date(inicio.getTime() + 86400000) },
        fechaFin: fin ? { gte: inicio } : { gte: inicio },
      },
    });
    if (conflicto) throw new AppError("El puesto ya tiene una reserva en ese rango de fechas", 409);
  }

  const reserva = await prisma.reserva.create({
    data: { clienteId: Number(clienteId), vehiculoId: vehiculoId ? Number(vehiculoId) : null, puestoId: puestoId ? Number(puestoId) : null, fechaInicio: inicio, fechaFin: fin, observaciones },
    include: { cliente: true, vehiculo: true, puesto: true },
  });
  if (puestoId) await ocuparPuesto(puestoId, req.usuario?.usuario);
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

  if (vehiculoId) {
    const duplicado = await prisma.reserva.findFirst({
      where: {
        vehiculoId: Number(vehiculoId),
        estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
        id: { not: Number(id) },
      },
    });
    if (duplicado) throw new AppError("El vehículo ya tiene una reserva activa (pendiente, confirmada o activa)", 400);
  }

  const data = {};
  if (estado && ESTADOS.includes(estado)) data.estado = estado;
  if (vehiculoId !== undefined) data.vehiculoId = vehiculoId ? Number(vehiculoId) : null;
  if (puestoId !== undefined) {
    const nuevoPuesto = puestoId ? Number(puestoId) : null;
    if (existente.puestoId && existente.puestoId !== nuevoPuesto) {
      await liberarPuesto(existente.puestoId, req.usuario?.usuario, "puesto reasignado");
    }
    if (nuevoPuesto) {
      const p = await prisma.puesto.findUnique({ where: { id: nuevoPuesto } });
      if (!p) throw new AppError("Puesto no encontrado", 404);
      if (p.estado === "MANTENIMIENTO") throw new AppError("El puesto está en mantenimiento", 400);
      if (p.estado === "OCUPADO") throw new AppError("El puesto está ocupado", 400);
      await ocuparPuesto(nuevoPuesto, req.usuario?.usuario);
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
      await tx.puesto.update({ where: { id: existente.puestoId }, data: { estado: "LIBRE" } });
    }

    if (["CANCELADA", "NO_SHOW"].includes(estado) && existente.puestoId) {
      await tx.puesto.update({ where: { id: existente.puestoId }, data: { estado: "LIBRE" } });
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
  await liberarPuesto(reserva.puestoId, req.usuario?.usuario, "cancelada");
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
  res.json({ ok: true, mensaje: "Reserva eliminada" });
});

export const liberarReservasVencidas = asyncHandler(async (req, res) => {
  const ahora = new Date();
  const vencidas = await prisma.reserva.findMany({
    where: {
      estado: { in: ["PENDIENTE", "CONFIRMADA"] },
      fechaInicio: { lt: ahora },
    },
    include: { cliente: true, puesto: true },
  });

  let liberadas = 0;
  for (const r of vencidas) {
    await prisma.reserva.update({ where: { id: r.id }, data: { estado: r.estado === "CONFIRMADA" ? "NO_SHOW" : "CANCELADA" } });
    if (r.puestoId) await liberarPuesto(r.puestoId, "sistema", `reserva #${r.id} vencida`);
    await registrarMovimiento("RESERVAS", "VENCER", `Reserva #${r.id} vencida — ${r.cliente?.nombres}`, "sistema");
    liberadas++;
  }

  res.json({ ok: true, liberadas, mensaje: `${liberadas} reserva(s) liberada(s)` });
});

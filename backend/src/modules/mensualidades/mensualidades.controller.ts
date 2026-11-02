import prisma from "../../config/prisma.js";
import type { Prisma } from "@prisma/client";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { generarNumeroFactura } from "../../services/facturaCounter.js";
import { sumarMesesConTope } from "../../utils/fechas.js";
import { calcularPagadoMensualidad } from "../../utils/saldos.js";
import { resolverSucursalPermitida } from "../../utils/sucursalAccess.js";


export const crearMensualidad = asyncHandler(async (req, res) => {
  const { clienteId, vehiculoId, puestoId, planId, fechaInicio, fechaFin, valor, observacion } = req.body;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.body.sucursalId);
  const cid = Number(clienteId);
  const vid = Number(vehiculoId);

  const cliente = await prisma.cliente.findUnique({ where: { id: cid } });
  if (!cliente) throw new AppError("Cliente no encontrado", 404);
  if (cliente.bloqueado) throw new AppError("El cliente está bloqueado", 400);

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vid } });
  if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
  if (sucursalId && vehiculo.sucursalId !== sucursalId) throw new AppError("El vehículo pertenece a otra sucursal", 403);
  if (sucursalId && vehiculo.sucursalId !== sucursalId) throw new AppError("El vehículo pertenece a otra sucursal", 403);
  if (vehiculo.clienteId !== cid) throw new AppError("El vehículo no pertenece al cliente seleccionado", 400);
  if (vehiculo.bloqueado) throw new AppError("El vehículo está bloqueado", 400);
  if (!vehiculo.estado) throw new AppError("El vehículo está inactivo", 400);

  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) throw new AppError("Fecha inválida", 400);
  if (fin <= inicio) throw new AppError("La fecha fin debe ser posterior a la fecha inicio", 400);
  if (fin <= new Date()) throw new AppError("La fecha fin debe estar en el futuro", 400);
  let plan = null;
  let monto = Number(valor);
  if (planId) {
    plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
    if (!plan || !plan.activo) throw new AppError("Plan no encontrado o inactivo", 400);
    monto = plan.valor;
  }
  if (!Number.isFinite(monto) || monto <= 0) throw new AppError("El valor de la mensualidad debe ser mayor que cero", 400);

  let puesto = null;
  if (puestoId) {
    puesto = await prisma.puesto.findUnique({ where: { id: Number(puestoId) } });
    if (!puesto) throw new AppError("Puesto no encontrado", 404);
    if (sucursalId && puesto.sucursalId !== sucursalId) throw new AppError("El puesto pertenece a otra sucursal", 403);
    if (!puesto.activo) throw new AppError("El puesto está inactivo", 400);
    if (puesto.estado === "MANTENIMIENTO") throw new AppError("El puesto está en mantenimiento", 400);
  }

  const ingresoActivo = await prisma.ingreso.findFirst({ where: { vehiculoId: vid, estado: "ACTIVO" } });
  if (ingresoActivo && (!puesto || ingresoActivo.puestoId !== puesto.id)) {
    throw new AppError("El vehículo ya tiene un ingreso activo en otro puesto", 400);
  }

  const data = { fechaInicio: inicio, fechaFin: fin, observacion, valor: monto };

  const mensualidad = await prisma.$transaction(async (tx) => {
    // Usa los mismos bloqueos que ingresos y reservas para serializar la asignación.
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${vid}::integer)) AS advisory_lock`;
    if (puesto) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${puesto.id}::integer)) AS advisory_lock`;
    const ahora = new Date();
    const [ingresoActual, mensualidadVehiculo, reservaVehiculo, conflictosPuesto] = await Promise.all([
      tx.ingreso.findFirst({ where: { vehiculoId: vid, estado: "ACTIVO" }, select: { id: true, puestoId: true } }),
      tx.mensualidad.findFirst({
        where: { vehiculoId: vid, estado: "ACTIVA", fechaInicio: { lte: fin }, fechaFin: { gte: inicio } },
        select: { id: true },
      }),
      tx.reserva.findFirst({
        where: {
          vehiculoId: vid, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
          fechaInicio: { lt: fin }, OR: [{ fechaFin: null }, { fechaFin: { gte: inicio } }],
        },
        select: { id: true },
      }),
      puesto ? tx.$queryRaw<Array<{ id: number }>>`SELECT "id" FROM "Reserva"
        WHERE "puestoId" = ${puesto.id}
          AND "estado" IN ('PENDIENTE', 'CONFIRMADA', 'ACTIVA')
          AND "fechaInicio" < ${fin}
          AND ("fechaFin" IS NULL OR "fechaFin" >= ${inicio})
        LIMIT 1` : Promise.resolve([]),
    ]);
    if (mensualidadVehiculo) throw new AppError("El vehículo ya tiene una mensualidad que se cruza con este periodo", 409);
    if (reservaVehiculo) throw new AppError("El vehículo tiene una reserva que se cruza con este periodo", 409);
    if (ingresoActual && (!puesto || ingresoActual.puestoId !== puesto.id || inicio > ahora || fin < ahora)) {
      throw new AppError("El vehículo ya tiene un ingreso activo en otro puesto", 409);
    }
    if (puesto) {
      const [otroIngreso, otraMensualidad, conflictoReserva] = await Promise.all([
        tx.ingreso.findFirst({ where: { puestoId: puesto.id, estado: "ACTIVO", ...(ingresoActual ? { id: { not: ingresoActual.id } } : {}) }, select: { id: true } }),
        tx.mensualidad.findFirst({
          where: { puestoId: puesto.id, estado: "ACTIVA", fechaInicio: { lte: fin }, fechaFin: { gte: inicio } },
          select: { id: true },
        }),
        tx.reserva.findFirst({
          where: {
            puestoId: puesto.id, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            fechaInicio: { lt: fin }, OR: [{ fechaFin: null }, { fechaFin: { gte: inicio } }],
          },
          select: { id: true },
        }),
      ]);
      if (puesto.estado === "OCUPADO" && !(ingresoActual && ingresoActual.puestoId === puesto.id)) {
        throw new AppError("El puesto ya no está disponible", 409);
      }
      if (otroIngreso || otraMensualidad || conflictoReserva || conflictosPuesto.length) {
        throw new AppError("El puesto tiene otra ocupación o asignación en ese periodo", 409);
      }
    }
    const m = await tx.mensualidad.create({
      data: { clienteId: cid, vehiculoId: vid, planId: plan ? Number(planId) : undefined, puestoId: puesto ? Number(puestoId) : undefined, sucursalId: sucursalId ?? null, ...data },
      include: { cliente: true, vehiculo: true, plan: true, puesto: true },
    });
    if (puesto) {
      const puestoActual = await tx.puesto.findUnique({ where: { id: puesto.id } });
      if (!puestoActual?.activo || puestoActual.estado === "MANTENIMIENTO") throw new AppError("El puesto dejó de estar disponible", 409);
      const mensualidadVigente = inicio <= ahora && fin >= ahora;
      await tx.puesto.update({
        where: { id: puesto.id },
        data: { estado: mensualidadVigente ? "OCUPADO" : "RESERVADO" },
      });
      if (mensualidadVigente) {
        const ingresoExistente = await tx.ingreso.findFirst({ where: { vehiculoId: vid, estado: "ACTIVO" } });
        if (!ingresoExistente) {
          await tx.ingreso.create({ data: { clienteId: cid, vehiculoId: vid, puestoId: puesto.id } });
        }
      }
    }
    return m;
  });
  await registrarMovimiento("MENSUALIDADES", "CREAR", `Mensualidad creada para ${mensualidad.cliente.nombres}`, req.usuario?.usuario);
  res.status(201).json({ ok: true, mensualidad });
});
export const obtenerMensualidades = asyncHandler(async (req, res) => {
  const { page, limit, estado, q } = req.query;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const where: Prisma.MensualidadWhereInput = sucursalId ? { sucursalId } : {};
  if (typeof estado === "string") where.estado = estado as string;
  if (typeof q === "string") {
    where.OR = [
      { cliente: { nombres: { contains: q, mode: "insensitive" } } },
      { cliente: { apellidos: { contains: q, mode: "insensitive" } } },
      { vehiculo: { placa: { contains: q, mode: "insensitive" } } },
    ];
  }

  const { data: mensualidades, pagination } = await paginate(prisma, "mensualidad", {
    page, limit, where,
    include: { cliente: true, vehiculo: true, plan: true, puesto: true, facturas: true },
    orderBy: { id: "desc" },
  });

  const vehiculoIds = mensualidades.filter(m => m.vehiculoId).map(m => m.vehiculoId);
  const ausenciasActivas = vehiculoIds.length > 0 ? await prisma.ausencia.findMany({
    where: { vehiculoId: { in: vehiculoIds }, estado: "ACTIVA" },
    select: { vehiculoId: true },
  }) : [];
  const activasSet = new Set(ausenciasActivas.map(a => a.vehiculoId));

  const result = mensualidades.map((m) => {
    const pagadoPeriodo = calcularPagadoMensualidad(m.facturas, m.fechaInicio);
    return { ...m, saldoPendiente: Math.max(0, m.valor - pagadoPeriodo), ausente: activasSet.has(m.vehiculoId) };
  });

  res.json({ ok: true, mensualidades: result, pagination });
});

export const obtenerMensualidad = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const mensualidad = await prisma.mensualidad.findFirst({
    where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) },
    include: { cliente: true, vehiculo: true, plan: true, puesto: true, facturas: true },
  });
  if (!mensualidad) throw new AppError("Mensualidad no encontrada", 404);
  const ausenciaActiva = mensualidad.vehiculoId ? await prisma.ausencia.findFirst({
    where: { vehiculoId: mensualidad.vehiculoId, estado: "ACTIVA" },
  }) : null;
  const pagadoPeriodo = calcularPagadoMensualidad(mensualidad.facturas, mensualidad.fechaInicio);
  res.json({ ok: true, mensualidad: { ...mensualidad, saldoPendiente: Math.max(0, mensualidad.valor - pagadoPeriodo), ausente: !!ausenciaActiva, ausencia: ausenciaActiva } });
});

export const obtenerVencidas = asyncHandler(async (req, res) => {
  const hoy = new Date();
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const vencidas = await prisma.mensualidad.findMany({
    where: { ...(sucursalId ? { sucursalId } : {}), fechaFin: { lt: hoy }, estado: { in: ["ACTIVA", "VENCIDA"] } },
    include: { cliente: true, vehiculo: true, plan: true, puesto: true },
  });
  res.json({ ok: true, vencidas });
});

export const renovarMensualidad = asyncHandler(async (req, res) => {
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const id = Number(req.params.id);
  const existente = await prisma.mensualidad.findFirst({ where: { id, ...(sucursalId ? { sucursalId } : {}) } });
  if (!existente) throw new AppError("Mensualidad no encontrada", 404);
  if (existente.estado === "CANCELADA") throw new AppError("No se puede renovar una mensualidad cancelada", 409);

  const ahora = new Date();
  // El nuevo periodo comienza después del anterior; se conserva la mensualidad histórica y sus facturas.
  const fechaInicio = existente.fechaFin > ahora ? new Date(existente.fechaFin.getTime() + 1) : ahora;
  const fechaFin = sumarMesesConTope(fechaInicio, 1);

  const renovada = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${existente.vehiculoId}::integer)) AS advisory_lock`;
    if (existente.puestoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${existente.puestoId}::integer)) AS advisory_lock`;
    const actual = await tx.mensualidad.findFirst({ where: { id, ...(sucursalId ? { sucursalId } : {}) } });
    if (
      !actual ||
      actual.estado === "CANCELADA" ||
      actual.vehiculoId !== existente.vehiculoId ||
      actual.puestoId !== existente.puestoId ||
      actual.fechaFin.getTime() !== existente.fechaFin.getTime() ||
      actual.estado !== existente.estado
    ) {
      throw new AppError("La mensualidad cambió mientras se renovaba. Actualiza e inténtalo nuevamente.", 409);
    }

    const [otraMensualidad, reserva, ingreso] = await Promise.all([
      tx.mensualidad.findFirst({
        where: { id: { not: id }, vehiculoId: actual.vehiculoId, estado: "ACTIVA", fechaInicio: { lt: fechaFin }, fechaFin: { gte: fechaInicio } },
        select: { id: true },
      }),
      tx.reserva.findFirst({
        where: { vehiculoId: actual.vehiculoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
          fechaInicio: { lt: fechaFin }, OR: [{ fechaFin: null }, { fechaFin: { gte: fechaInicio } }] },
        select: { id: true },
      }),
      tx.ingreso.findFirst({ where: { vehiculoId: actual.vehiculoId, estado: "ACTIVO" }, select: { id: true, puestoId: true } }),
    ]);
    if (otraMensualidad || reserva) throw new AppError("El vehículo ya tiene otra asignación que se cruza con la renovación", 409);
    if (ingreso && (!actual.puestoId || ingreso.puestoId !== actual.puestoId || fechaInicio > ahora)) {
      throw new AppError("El vehículo tiene un ingreso activo incompatible con el periodo de renovación", 409);
    }

    if (actual.puestoId) {
      const puestoActual = await tx.puesto.findUnique({ where: { id: actual.puestoId } });
      if (!puestoActual?.activo || puestoActual.estado === "MANTENIMIENTO") throw new AppError("El puesto no está disponible para renovar", 409);
      const [otraMensualidadPuesto, reservaPuesto, ingresoEnPuesto] = await Promise.all([
        tx.mensualidad.findFirst({
          where: { id: { not: id }, puestoId: actual.puestoId, estado: "ACTIVA", fechaInicio: { lt: fechaFin }, fechaFin: { gte: fechaInicio } },
          select: { id: true },
        }),
        tx.reserva.findFirst({
          where: { puestoId: actual.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            fechaInicio: { lt: fechaFin }, OR: [{ fechaFin: null }, { fechaFin: { gte: fechaInicio } }] },
          select: { id: true },
        }),
        tx.ingreso.findFirst({ where: { puestoId: actual.puestoId, estado: "ACTIVO", ...(ingreso ? { id: { not: ingreso.id } } : {}) }, select: { id: true } }),
      ]);
      if (otraMensualidadPuesto || reservaPuesto || ingresoEnPuesto) throw new AppError("El puesto tiene otra asignación que se cruza con la renovación", 409);
    }

    const nueva = await tx.mensualidad.create({
      data: {
        clienteId: actual.clienteId,
        vehiculoId: actual.vehiculoId,
        planId: actual.planId,
        puestoId: actual.puestoId,
        fechaInicio,
        fechaFin,
        valor: actual.valor,
        observacion: actual.observacion,
        estado: "ACTIVA",
        sucursalId: actual.sucursalId,
      },
      include: { cliente: true, vehiculo: true, plan: true, puesto: true },
    });

    if (fechaInicio <= ahora && actual.puestoId) {
      if (!ingreso) {
        await tx.ingreso.create({ data: { clienteId: actual.clienteId, vehiculoId: actual.vehiculoId, puestoId: actual.puestoId } });
      }
      await tx.puesto.update({ where: { id: actual.puestoId }, data: { estado: "OCUPADO" } });
    } else if (actual.puestoId && actual.fechaFin <= ahora && !ingreso) {
      await tx.puesto.update({ where: { id: actual.puestoId }, data: { estado: "RESERVADO" } });
    }
    if (actual.fechaFin < ahora && actual.estado === "ACTIVA") {
      await tx.mensualidad.update({ where: { id }, data: { estado: "VENCIDA" } });
    }
    return nueva;
  });
  await registrarMovimiento("MENSUALIDADES", "RENOVAR", `Mensualidad #${id} renovada como #${renovada.id}`, req.usuario?.usuario);
  res.json({ ok: true, renovada });
});


export const actualizarMensualidad = asyncHandler(async (req, res) => {
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const id = Number(req.params.id);
  const { vehiculoId, planId, puestoId, fechaInicio, fechaFin, valor, observacion } = req.body;
  const existente = await prisma.mensualidad.findFirst({ where: { id, ...(sucursalId ? { sucursalId } : {}) }, include: { facturas: { select: { id: true } } } });
  if (!existente) throw new AppError("Mensualidad no encontrada", 404);
  if (existente.estado === "CANCELADA") throw new AppError("No se puede editar una mensualidad cancelada", 409);

  const vid = vehiculoId !== undefined ? (vehiculoId ? Number(vehiculoId) : existente.vehiculoId) : existente.vehiculoId;
  const nuevoPuestoId = puestoId !== undefined ? (puestoId ? Number(puestoId) : null) : existente.puestoId;
  const inicio = fechaInicio !== undefined ? new Date(fechaInicio) : existente.fechaInicio;
  const fin = fechaFin !== undefined ? new Date(fechaFin) : existente.fechaFin;
  const monto = valor !== undefined ? Number(valor) : existente.valor;
  if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fin.getTime()) || fin <= inicio) {
    throw new AppError("El periodo de la mensualidad no es válido", 400);
  }
  if (!Number.isFinite(monto) || monto <= 0) throw new AppError("El valor debe ser mayor que cero", 400);

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vid } });
  if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
  if (vehiculo.clienteId !== existente.clienteId) throw new AppError("El vehículo no pertenece al cliente de esta mensualidad", 400);
  if (vehiculo.bloqueado || !vehiculo.estado) throw new AppError("El vehículo está bloqueado o inactivo", 400);

  let montoFinal = monto;
  let nuevoPlanId: number | null = planId !== undefined ? (planId ? Number(planId) : null) : existente.planId;
  if (existente.facturas.length > 0 && (
    vid !== existente.vehiculoId ||
    inicio.getTime() !== existente.fechaInicio.getTime() ||
    fin.getTime() !== existente.fechaFin.getTime() ||
    montoFinal !== existente.valor ||
    nuevoPlanId !== existente.planId
  )) {
    throw new AppError("No se pueden cambiar vehículo, periodo, plan o valor de una mensualidad con facturas emitidas. Cree una renovación para conservar el historial.", 409);
  }
  if (planId) {
    const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
    if (!plan?.activo) throw new AppError("El plan no existe o está inactivo", 400);
    montoFinal = plan.valor;
  }

  const actualizada = await prisma.$transaction(async (tx) => {
    const vehiculosLocks = [...new Set([existente.vehiculoId, vid])].sort((a, b) => a - b);
    const puestosLocks = [...new Set([existente.puestoId, nuevoPuestoId].filter((v): v is number => v !== null))].sort((a, b) => a - b);
    for (const lockId of vehiculosLocks) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${lockId}::integer)) AS advisory_lock`;
    for (const lockId of puestosLocks) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${lockId}::integer)) AS advisory_lock`;

    const actual = await tx.mensualidad.findFirst({ where: { id, ...(sucursalId ? { sucursalId } : {}) } });
    if (
      !actual ||
      actual.vehiculoId !== existente.vehiculoId ||
      actual.puestoId !== existente.puestoId ||
      actual.updatedAt.getTime() !== existente.updatedAt.getTime()
    ) {
      throw new AppError("La mensualidad cambió mientras se editaba. Actualiza e inténtalo nuevamente.", 409);
    }
    const finLimite = fin;
    const [otraMensualidad, reservaVehiculo] = await Promise.all([
      tx.mensualidad.findFirst({
        where: { id: { not: id }, vehiculoId: vid, estado: "ACTIVA", fechaInicio: { lt: finLimite }, fechaFin: { gte: inicio } },
        select: { id: true },
      }),
      tx.reserva.findFirst({
        where: { vehiculoId: vid, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
          fechaInicio: { lt: finLimite }, OR: [{ fechaFin: null }, { fechaFin: { gte: inicio } }] },
        select: { id: true },
      }),
    ]);
    if (otraMensualidad || reservaVehiculo) throw new AppError("El vehículo tiene otra mensualidad o reserva en ese periodo", 409);

    const ingresoAnterior = vid !== actual.vehiculoId
      ? await tx.ingreso.findFirst({ where: { vehiculoId: actual.vehiculoId, estado: "ACTIVO" }, select: { id: true } })
      : null;
    if (ingresoAnterior) throw new AppError("No se puede cambiar el vehículo mientras tenga un ingreso activo", 409);
    const ingresoVehiculo = await tx.ingreso.findFirst({ where: { vehiculoId: vid, estado: "ACTIVO" }, select: { id: true, puestoId: true } });
    if (ingresoVehiculo && (!nuevoPuestoId || ingresoVehiculo.puestoId !== nuevoPuestoId || inicio > new Date() || fin < new Date())) {
      throw new AppError("El vehículo tiene un ingreso activo incompatible con la nueva asignación", 409);
    }

    if (nuevoPuestoId) {
      const [puesto, otraMensualidadPuesto, reservaPuesto, ingresoPuesto] = await Promise.all([
        tx.puesto.findUnique({ where: { id: nuevoPuestoId } }),
        tx.mensualidad.findFirst({
          where: { id: { not: id }, puestoId: nuevoPuestoId, estado: "ACTIVA", fechaInicio: { lt: finLimite }, fechaFin: { gte: inicio } },
          select: { id: true },
        }),
        tx.reserva.findFirst({
          where: { puestoId: nuevoPuestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            fechaInicio: { lt: finLimite }, OR: [{ fechaFin: null }, { fechaFin: { gte: inicio } }] },
          select: { id: true },
        }),
        tx.ingreso.findFirst({ where: { puestoId: nuevoPuestoId, estado: "ACTIVO", ...(ingresoVehiculo ? { id: { not: ingresoVehiculo.id } } : {}) }, select: { id: true } }),
      ]);
      if (!puesto?.activo || puesto.estado === "MANTENIMIENTO") throw new AppError("El puesto no está disponible", 409);
      if (sucursalId && puesto.sucursalId !== sucursalId) throw new AppError("El puesto pertenece a otra sucursal", 403);
      if (vehiculo.sucursalId !== puesto.sucursalId) throw new AppError("El vehículo y el puesto deben pertenecer a la misma sucursal", 409);
      if (otraMensualidadPuesto || reservaPuesto || ingresoPuesto) throw new AppError("El puesto tiene otra ocupación o asignación en ese periodo", 409);
      if (puesto.estado === "OCUPADO" && !(ingresoVehiculo && ingresoVehiculo.puestoId === nuevoPuestoId)) {
        throw new AppError("El puesto está ocupado", 409);
      }
    }

    const actualizada = await tx.mensualidad.update({
      where: { id },
      data: {
        vehiculoId: vid,
        puestoId: nuevoPuestoId,
        planId: nuevoPlanId,
        fechaInicio: inicio,
        fechaFin: fin,
        valor: montoFinal,
        estado: fin < new Date() ? "VENCIDA" : "ACTIVA",
        ...(observacion !== undefined ? { observacion } : {}),
      },
      include: { cliente: true, vehiculo: true, plan: true, puesto: true },
    });

    const ahora = new Date();
    const vigente = inicio <= ahora && fin >= ahora;
    const futura = inicio > ahora;
    if (nuevoPuestoId) {
      if (vigente) {
        if (ingresoVehiculo && ingresoVehiculo.puestoId !== nuevoPuestoId) {
          await tx.ingreso.update({ where: { id: ingresoVehiculo.id }, data: { puestoId: nuevoPuestoId } });
        } else if (!ingresoVehiculo) {
          await tx.ingreso.create({ data: { clienteId: actual.clienteId, vehiculoId: vid, puestoId: nuevoPuestoId } });
        }
        await tx.puesto.update({ where: { id: nuevoPuestoId }, data: { estado: "OCUPADO" } });
      } else if (futura) {
        await tx.puesto.update({ where: { id: nuevoPuestoId }, data: { estado: "RESERVADO" } });
      } else {
        const [ingresos, mensualidades, reservas] = await Promise.all([
          tx.ingreso.count({ where: { puestoId: nuevoPuestoId, estado: "ACTIVO" } }),
          tx.mensualidad.count({ where: { puestoId: nuevoPuestoId, estado: "ACTIVA", id: { not: id }, fechaFin: { gte: ahora } } }),
          tx.reserva.count({ where: { puestoId: nuevoPuestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] } }),
        ]);
        const estadoPuesto = ingresos > 0 ? "OCUPADO" : mensualidades + reservas > 0 ? "RESERVADO" : "LIBRE";
        await tx.puesto.update({ where: { id: nuevoPuestoId }, data: { estado: estadoPuesto } });
      }
    }

    if (actual.puestoId && actual.puestoId !== nuevoPuestoId) {
      const [ingresos, mensualidades, reservas] = await Promise.all([
        tx.ingreso.count({ where: { puestoId: actual.puestoId, estado: "ACTIVO" } }),
        tx.mensualidad.count({ where: { puestoId: actual.puestoId, estado: "ACTIVA", id: { not: id }, fechaFin: { gte: ahora } } }),
        tx.reserva.count({ where: { puestoId: actual.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] } }),
      ]);
      const estadoPuesto = ingresos > 0 ? "OCUPADO" : mensualidades + reservas > 0 ? "RESERVADO" : "LIBRE";
      await tx.puesto.update({ where: { id: actual.puestoId }, data: { estado: estadoPuesto } });
    }
    return actualizada;
  });
  await registrarMovimiento("MENSUALIDADES", "EDITAR", `Mensualidad #${id} editada`, req.usuario?.usuario);
  res.json({ ok: true, mensualidad: actualizada });
});


export const cancelarMensualidad = asyncHandler(async (req, res) => {
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const { id } = req.params;
  const existente = await prisma.mensualidad.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) } });
  if (!existente) throw new AppError("Mensualidad no encontrada", 404);
  if (existente.estado !== "ACTIVA") throw new AppError("Solo se puede cancelar una mensualidad activa", 400);

  const cancelada = await prisma.$transaction(async (tx) => {
    // Sincroniza la cancelación con entradas, reservas y otras asignaciones del mismo recurso.
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${existente.vehiculoId}::integer)) AS advisory_lock`;
    if (existente.puestoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${existente.puestoId}::integer)) AS advisory_lock`;
    const actual = await tx.mensualidad.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) } });
    if (
      !actual ||
      actual.estado !== "ACTIVA" ||
      actual.vehiculoId !== existente.vehiculoId ||
      actual.puestoId !== existente.puestoId
    ) {
      throw new AppError("La mensualidad cambió mientras se cancelaba. Actualiza e inténtalo nuevamente.", 409);
    }
    const c = await tx.mensualidad.update({
      where: { id: Number(id) },
      data: { estado: "CANCELADA" },
      include: { cliente: true, vehiculo: true, plan: true, puesto: true },
    });
    if (actual.puestoId) {
      const ahora = new Date();
      const [ingresoActivo, mensualidadVigente, reservaVigente] = await Promise.all([
        tx.ingreso.count({ where: { puestoId: actual.puestoId, estado: "ACTIVO" } }),
        tx.mensualidad.count({ where: { puestoId: actual.puestoId, estado: "ACTIVA", id: { not: Number(id) }, fechaFin: { gte: ahora } } }),
        tx.reserva.count({
          where: {
            puestoId: actual.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }],
          },
        }),
      ]);
      const estadoPuesto = ingresoActivo > 0 ? "OCUPADO" : mensualidadVigente + reservaVigente > 0 ? "RESERVADO" : "LIBRE";
      await tx.puesto.update({ where: { id: actual.puestoId }, data: { estado: estadoPuesto } });
    }
    return c;
  });
  await registrarMovimiento("MENSUALIDADES", "CANCELAR", `Mensualidad #${id} cancelada`, req.usuario?.usuario);
  res.json({ ok: true, mensualidad: cancelada });
});

export const eliminarMensualidad = asyncHandler(async (req, res) => {
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const { id } = req.params;
  const existente = await prisma.mensualidad.findFirst({
    where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) },
    include: { facturas: { select: { id: true, numero: true } } },
  });
  if (!existente) throw new AppError("Mensualidad no encontrada", 404);
  if (existente.estado === "ACTIVA") throw new AppError("No se puede eliminar una mensualidad activa. Cáncela primero.", 400);
  if (existente.facturas.length > 0) {
    throw new AppError("Esta mensualidad tiene facturas emitidas. No se puede eliminar porque forma parte del historial financiero; utiliza la cancelación para conservar la auditoría.", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${existente.vehiculoId}::integer)) AS advisory_lock`;
    if (existente.puestoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${existente.puestoId}::integer)) AS advisory_lock`;
    const actual = await tx.mensualidad.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) }, include: { facturas: { select: { id: true } } } });
    if (!actual) throw new AppError("Mensualidad no encontrada", 404);
    if (actual.vehiculoId !== existente.vehiculoId || actual.puestoId !== existente.puestoId) {
      throw new AppError("La mensualidad cambió mientras se eliminaba. Actualiza e inténtalo nuevamente.", 409);
    }
    if (actual.estado === "ACTIVA") throw new AppError("No se puede eliminar una mensualidad activa. Cáncela primero.", 409);
    if (actual.facturas.length > 0) throw new AppError("Esta mensualidad tiene facturas emitidas y no se puede eliminar", 409);
    await tx.mensualidad.delete({ where: { id: Number(id) } });
    if (actual.puestoId) {
      const ahora = new Date();
      const [ingresos, mensualidades, reservas] = await Promise.all([
        tx.ingreso.count({ where: { puestoId: actual.puestoId, estado: "ACTIVO" } }),
        tx.mensualidad.count({ where: { puestoId: actual.puestoId, estado: "ACTIVA", fechaFin: { gte: ahora } } }),
        tx.reserva.count({
          where: {
            puestoId: actual.puestoId,
            estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }],
          },
        }),
      ]);
      const estadoPuesto = ingresos > 0 ? "OCUPADO" : mensualidades + reservas > 0 ? "RESERVADO" : "LIBRE";
      await tx.puesto.update({ where: { id: actual.puestoId }, data: { estado: estadoPuesto } });
    }
  });
  await registrarMovimiento("MENSUALIDADES", "ELIMINAR", `Mensualidad #${id} eliminada`, req.usuario?.usuario);
  res.json({ ok: true, message: "Mensualidad eliminada correctamente" });
});

export const cobrarMensualidad = asyncHandler(async (req, res) => {
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const { id } = req.params;
  const { metodoPago, monto } = req.body;
  const mp = metodoPago || "efectivo";
  if (typeof mp !== "string" || !mp.trim() || mp.trim().length > 60) {
    throw new AppError("El método de pago no es válido", 400);
  }

  const resultado = await prisma.$transaction(async (tx) => {
    // Bloquea la mensualidad para que dos abonos simultáneos no excedan su saldo.
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124018, ${Number(id)}::integer)) AS advisory_lock`;
    await tx.$queryRaw`SELECT id FROM "Mensualidad" WHERE id = ${Number(id)} FOR UPDATE`;

    // El mismo bloqueo global de caja se usa al abrir, cerrar y registrar otros movimientos.
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124019)) AS advisory_lock`;

    const mensualidad = await tx.mensualidad.findFirst({
      where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) },
      include: { plan: true },
    });
    if (!mensualidad) throw new AppError("Mensualidad no encontrada", 404);
    if (mensualidad.estado !== "ACTIVA") throw new AppError("La mensualidad no está activa", 400);

    const pagos = await tx.factura.aggregate({
      _sum: { valor: true },
      where: { mensualidadId: mensualidad.id, createdAt: { gte: mensualidad.fechaInicio }, metodoPago: { not: null } },
    });
    const saldoPendiente = Math.max(0, mensualidad.valor - (pagos._sum.valor || 0));
    const montoPagado = monto !== undefined ? Number(monto) : saldoPendiente;

    if (!Number.isFinite(montoPagado) || montoPagado <= 0) throw new AppError("El monto debe ser un número mayor a 0", 400);
    if (montoPagado > saldoPendiente) {
      throw new AppError(`El monto excede el saldo pendiente ($${saldoPendiente.toLocaleString()})`, 400);
    }

    const cajaAbierta = await tx.caja.findFirst({ where: { estado: "ABIERTA", ...(mensualidad.sucursalId ? { sucursalId: mensualidad.sucursalId } : sucursalId ? { sucursalId } : {}) } });
    if (!cajaAbierta) throw new AppError("La caja se cerró antes de registrar el pago. Abre una caja e inténtalo de nuevo.", 409);

    const numeroFactura = await generarNumeroFactura("FACT-MEN");
    const factura = await tx.factura.create({
      data: {
        numero: numeroFactura,
        mensualidadId: mensualidad.id,
        origen: "MENSUALIDAD",
        valor: montoPagado,
        metodoPago: mp,
      },
    });
    await tx.cajaMovimiento.create({
      data: {
        cajaId: cajaAbierta.id,
        tipo: "INGRESO",
        concepto: `Factura ${numeroFactura} — Mensualidad #${id}`,
        monto: montoPagado,
        metodoPago: mp,
        facturaId: factura.id,
      },
    });

    const nuevoSaldo = Math.max(0, saldoPendiente - montoPagado);
    const renovada = nuevoSaldo <= 0;
    if (renovada) {
      const fechaInicio = new Date();
      const fechaFin = new Date(fechaInicio);
      fechaFin.setDate(fechaFin.getDate() + (mensualidad.plan?.duracionDias || 30));
      await tx.mensualidad.update({
        where: { id: mensualidad.id },
        data: { fechaInicio, fechaFin, estado: "ACTIVA" },
      });
    }

    return {
      factura,
      saldoPendiente: nuevoSaldo,
      renovada,
      cajaId: cajaAbierta.id,
      numeroFactura,
      montoPagado,
    };
  });

  await registrarMovimiento("FACTURACION", "CREAR", `Factura ${resultado.numeroFactura} por mensualidad #${id} — $${resultado.montoPagado}`, req.usuario?.usuario || "admin");
  const cajaActualizada = await prisma.caja.findFirst({ where: { id: resultado.cajaId, ...(sucursalId ? { sucursalId } : {}) } });

  res.json({
    ok: true,
    factura: resultado.factura,
    caja: cajaActualizada,
    saldoPendiente: resultado.saldoPendiente,
    renovada: resultado.renovada,
    mensaje: resultado.renovada
      ? `Pago completo — Factura ${resultado.numeroFactura}. Mensualidad renovada según la duración del plan.`
      : `Abono registrado — Factura ${resultado.numeroFactura}. Saldo pendiente: $${resultado.saldoPendiente.toLocaleString()}`,
  });
});

export const generarFacturasPendientes = asyncHandler(async (req, res) => {
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const hoy = new Date();
  const activas = await prisma.mensualidad.findMany({
    where: { estado: "ACTIVA", fechaFin: { gte: hoy }, ...(sucursalId ? { sucursalId } : {}) },
    include: { cliente: true, vehiculo: true, facturas: true },
  });

  let generadas = 0;
  for (const m of activas) {
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);
    const tieneFacturaMes = m.facturas.some(f => {
      const fDate = new Date(f.createdAt);
      return fDate >= inicioMes && fDate <= finMes;
    });
    if (tieneFacturaMes) continue;

    await prisma.$transaction(async (tx) => {
      const numeroFactura = await generarNumeroFactura("FACT-MEN");
      await tx.factura.create({
        data: {
          numero: numeroFactura,
          mensualidadId: m.id,
          origen: "MENSUALIDAD_AUTO",
          valor: m.valor,
          metodoPago: null,
          sucursalId: m.sucursalId,
        },
      });
    });
    generadas++;
  }

  await registrarMovimiento("FACTURACION", "GENERAR_AUTO", `${generadas} factura(s) generadas automáticamente`, req.usuario?.usuario || "admin");

  res.json({ ok: true, generadas, total: activas.length });
});

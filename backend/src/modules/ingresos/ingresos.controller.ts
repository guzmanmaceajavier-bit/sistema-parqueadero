import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { emitirEvento } from "../../services/socket.js";
import { calcularCobro } from "../../services/calculadorCobros.js";
import { generarNumeroFactura } from "../../services/facturaCounter.js";
import { getCajaAbierta, getCajaOError } from "../../helpers/caja.js";
import { generarTicketPDF } from "../../services/ticket.service.js";
import * as service from "./ingresos.service.js";

async function puestoEstaDisponibleParaAsignar(tx: any, puestoId: number, asignacion: { vehiculoId?: number; reservaId?: number } = {}) {
  const puesto = await tx.puesto.findUnique({ where: { id: puestoId } });
  if (!puesto || !puesto.activo) return false;

  const ahora = new Date();
  const [ingresos, otrasMensualidades, otrasReservas, mensualidadPropia, reservaPropia] = await Promise.all([
    tx.ingreso.count({ where: { puestoId, estado: "ACTIVO" } }),
    tx.mensualidad.count({
      where: {
        puestoId,
        estado: "ACTIVA",
        fechaInicio: { lte: ahora },
        fechaFin: { gte: ahora },
        ...(asignacion.vehiculoId ? { vehiculoId: { not: asignacion.vehiculoId } } : {}),
      },
    }),
    tx.reserva.count({
      where: {
        puestoId,
        estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
        OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }],
        ...(asignacion.reservaId ? { id: { not: asignacion.reservaId } } : {}),
      },
    }),
    asignacion.vehiculoId
      ? tx.mensualidad.count({
          where: { puestoId, vehiculoId: asignacion.vehiculoId, estado: "ACTIVA", fechaInicio: { lte: ahora }, fechaFin: { gte: ahora } },
        })
      : 0,
    asignacion.reservaId
      ? tx.reserva.count({
          where: { id: asignacion.reservaId, puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA"] }, fechaInicio: { lte: ahora }, OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] },
        })
      : 0,
  ]);

  const sinConflictos = ingresos === 0 && otrasMensualidades === 0 && otrasReservas === 0;
  const estadoCompatible = puesto.estado === "LIBRE"
    || (puesto.estado === "RESERVADO" && (mensualidadPropia > 0 || reservaPropia > 0));
  return sinConflictos && estadoCompatible;
}

export const registrarIngreso = asyncHandler(async (req, res) => {
  let { clienteId, vehiculoId, puestoId } = req.body;
  clienteId = Number(clienteId);
  vehiculoId = Number(vehiculoId);

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) throw new AppError("Cliente no encontrado", 404);
  if (cliente.bloqueado) throw new AppError("El cliente está bloqueado y no puede ingresar", 400);

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
  if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
  if (vehiculo.clienteId !== clienteId) throw new AppError("El vehículo no pertenece al cliente seleccionado", 400);
  if (vehiculo.bloqueado) throw new AppError("El vehículo está bloqueado y no puede ingresar", 400);
  if (!vehiculo.estado) throw new AppError("El vehículo está inactivo", 400);

  let reservaVinculada = await service.buscarReservaActiva(clienteId, vehiculoId);
  let planDetectado = null;
  if (reservaVinculada) {
    if (reservaVinculada.puestoId && puestoId && Number(puestoId) !== reservaVinculada.puestoId) {
      throw new AppError("El vehículo tiene una reserva vigente para otro puesto. Utiliza el puesto reservado.", 409);
    }
    if (reservaVinculada.puestoId) puestoId = reservaVinculada.puestoId;
  } else {
    const mensualidadVigente = await prisma.mensualidad.findFirst({
      where: { vehiculoId: vehiculoId, estado: "ACTIVA", fechaInicio: { lte: new Date() }, fechaFin: { gte: new Date() }, puestoId: { not: null } },
      include: { plan: true, puesto: true },
    });
    if (mensualidadVigente?.puestoId) {
      if (puestoId && Number(puestoId) !== mensualidadVigente.puestoId) {
        throw new AppError("El vehículo tiene un puesto asignado por su mensualidad. Utiliza el puesto del plan.", 409);
      }
      puestoId = mensualidadVigente.puestoId;
      planDetectado = mensualidadVigente;
    }
  }

  if (!puestoId) throw new AppError("Debes seleccionar un puesto o tener una reserva activa o plan vigente", 400);

  const puesto = await prisma.puesto.findUnique({ where: { id: Number(puestoId) } });
  if (!puesto) throw new AppError("Puesto no encontrado", 404);
  if (!puesto.activo) throw new AppError("El puesto está inactivo", 400);

  const placa = req.body.placa || vehiculo.placa;
  const existenteActivo = await prisma.ingreso.findFirst({
    where: { vehiculoId: vehiculoId, estado: "ACTIVO" },
  });
  if (existenteActivo) throw new AppError(`El vehículo con placa ${placa} ya se encuentra dentro del parqueadero`, 400);

  const ingreso = await prisma.$transaction(async (tx) => {
    // Bloqueos transaccionales por vehículo y puesto: serializan intentos simultáneos.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124021, ${vehiculoId})`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124020, ${Number(puestoId)})`;
    const vehiculoYaDentro = await tx.ingreso.findFirst({
      where: { vehiculoId, estado: "ACTIVO" },
      select: { id: true },
    });
    if (vehiculoYaDentro) {
      throw new AppError(`El vehículo con placa ${placa} ya tiene un ingreso activo`, 409);
    }

    // Relee reservas y mensualidades dentro del bloqueo: los datos consultados antes
    // de abrir la transacción podrían haber cambiado mientras se esperaba el puesto.
    const ahora = new Date();
    const [reservaActual, mensualidadActual] = await Promise.all([
      tx.reserva.findFirst({
        where: {
          clienteId,
          vehiculoId,
          estado: { in: ["PENDIENTE", "CONFIRMADA"] },
          fechaInicio: { lte: ahora },
          OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }],
        },
        include: { puesto: true },
        orderBy: { fechaInicio: "asc" },
      }),
      tx.mensualidad.findFirst({
        where: {
          vehiculoId,
          estado: "ACTIVA",
          fechaInicio: { lte: ahora },
          fechaFin: { gte: ahora },
          puestoId: { not: null },
        },
        include: { plan: true },
      }),
    ]);

    if (reservaVinculada && !reservaActual) {
      throw new AppError("La reserva seleccionada cambió o dejó de estar vigente. Actualiza la información antes de registrar la entrada.", 409);
    }
    if (reservaActual?.puestoId && Number(puestoId) !== reservaActual.puestoId) {
      throw new AppError("El vehículo tiene una reserva vigente para otro puesto. Actualiza la disponibilidad.", 409);
    }
    if (mensualidadActual?.puestoId && Number(puestoId) !== mensualidadActual.puestoId) {
      throw new AppError("El vehículo tiene un puesto asignado por su mensualidad. Actualiza la disponibilidad.", 409);
    }
    if (
      reservaActual?.puestoId &&
      mensualidadActual?.puestoId &&
      reservaActual.puestoId !== mensualidadActual.puestoId
    ) {
      throw new AppError("La reserva y la mensualidad asignan puestos diferentes. Revisa las asignaciones antes de ingresar el vehículo.", 409);
    }
    reservaVinculada = reservaActual;
    planDetectado = mensualidadActual;

    const disponible = await puestoEstaDisponibleParaAsignar(tx, Number(puestoId), { vehiculoId, reservaId: reservaVinculada?.id });
    if (!disponible) throw new AppError("El puesto no está disponible para asignar", 409);

    // La actualización condicional evita que dos solicitudes ocupen el mismo puesto.
    const puestoReservado = await tx.puesto.updateMany({
      where: { id: Number(puestoId), activo: true, estado: { in: ["LIBRE", "RESERVADO"] } },
      data: { estado: "OCUPADO" },
    });
    if (puestoReservado.count !== 1) {
      throw new AppError("El puesto acaba de ser asignado a otro vehículo. Actualiza la disponibilidad e inténtalo de nuevo.", 409);
    }

    const data: any = { clienteId, vehiculoId, puestoId: Number(puestoId) };
    if (reservaVinculada) {
      data.reservaId = reservaVinculada.id;
      await tx.reserva.update({ where: { id: reservaVinculada.id }, data: { estado: "ACTIVA" } });
    }
    return tx.ingreso.create({
      data,
      include: { cliente: true, vehiculo: true, puesto: true },
    });
  });

  const tipoIngreso = planDetectado ? "plan_mensual" : (reservaVinculada ? "reserva" : "normal");
  await registrarMovimiento("INGRESOS", "ENTRADA", `Vehículo ${ingreso.vehiculo.placa} ingresó al puesto ${puesto.codigo}${planDetectado ? ` — plan ${planDetectado.plan?.nombre}` : reservaVinculada ? " (reserva)" : ""}`, req.usuario?.usuario || "admin");
  emitirEvento("ingreso:entrada", { mensaje: `Vehículo ${ingreso.vehiculo.placa} ingresó al puesto ${puesto.codigo}`, cliente: ingreso.cliente, vehiculo: ingreso.vehiculo, puesto: ingreso.puesto, fecha: ingreso.fechaEntrada, tipoIngreso, plan: planDetectado?.plan });

  res.status(201).json({ ok: true, ingreso, reservaAsignada: !!reservaVinculada, planAsignado: planDetectado ? { id: planDetectado.id, nombre: planDetectado.plan?.nombre, fechaFin: planDetectado.fechaFin } : null, tipoIngreso });
});

export const obtenerIngresos = asyncHandler(async (req, res) => {
  const { page, limit, estado, clienteId, q } = req.query;
  const where: any = {};
  if (estado) where.estado = String(estado);
  if (clienteId) where.clienteId = Number(clienteId);
  if (q) {
    const queryText = String(q);
    where.OR = [
      { cliente: { nombres: { contains: queryText, mode: "insensitive" } } },
      { cliente: { apellidos: { contains: queryText, mode: "insensitive" } } },
      { vehiculo: { placa: { contains: queryText, mode: "insensitive" } } },
      { puesto: { codigo: { contains: queryText, mode: "insensitive" } } },
    ];
  }

  const { data: ingresos, pagination } = await paginate(prisma, "ingreso", {
    page, limit, where,
    include: { cliente: true, vehiculo: true, puesto: true },
    orderBy: { id: "desc" },
  });

  const vehiculoIdsFinalizados: number[] = [...new Set<number>(ingresos.filter((i: any) => i.fechaSalida).map((i: any) => Number(i.vehiculoId)))];
  const ausenciasMap: Record<number, any> = {};
  if (vehiculoIdsFinalizados.length > 0) {
    const ausencias = await prisma.ausencia.findMany({
      where: { vehiculoId: { in: vehiculoIdsFinalizados }, estado: "FINALIZADA" },
      select: { id: true, vehiculoId: true, motivo: true, opcion: true, fechaSalida: true },
    });
    for (const a of ausencias) {
      ausenciasMap[a.vehiculoId] = a;
    }
  }

  const result = ingresos.map(ing => {
    const aus = ing.fechaSalida ? ausenciasMap[ing.vehiculoId] : null;
    const esAusencia = aus && Math.abs(new Date(aus.fechaSalida).getTime() - new Date(ing.fechaSalida).getTime()) < 1800000;
    return { ...ing, esAusencia: !!esAusencia, ausencia: esAusencia ? aus : undefined };
  });

  res.json({ ok: true, ingresos: result, pagination });
});

export const obtenerIngreso = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ingreso = await prisma.ingreso.findUnique({
    where: { id: Number(id) },
    include: { cliente: true, vehiculo: true, puesto: true, facturas: true },
  });
  if (!ingreso) throw new AppError("Ingreso no encontrado", 404);
  res.json({ ok: true, ingreso });
});

export const liberarPuesto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ingreso = await prisma.ingreso.findUnique({ where: { id: Number(id) } });
  if (!ingreso) throw new AppError("Ingreso no encontrado", 404);
  if (ingreso.estado === "FINALIZADO") throw new AppError("Este ingreso ya fue finalizado", 400);

  const planActivo = await prisma.mensualidad.findFirst({
    where: {
      vehiculoId: ingreso.vehiculoId,
      estado: "ACTIVA",
      fechaInicio: { lte: new Date() },
      fechaFin: { gte: new Date() },
      OR: [{ puestoId: null }, { puestoId: ingreso.puestoId }],
    },
  });
  if (!planActivo) throw new AppError("El vehículo no tiene plan activo. Registre la salida con cobro desde Ingresos.", 400);

  const fechaSalida = new Date();
  const tiempoMinutos = Math.ceil((fechaSalida.getTime() - new Date(ingreso.fechaEntrada).getTime()) / (1000 * 60));

  await prisma.$transaction(async (tx) => {
    // Serializa la liberación con nuevas entradas, ediciones y salidas del mismo vehículo/puesto.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124021, ${ingreso.vehiculoId})`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124020, ${ingreso.puestoId})`;

    const ingresoActual = await tx.ingreso.findFirst({
      where: { id: Number(id), estado: "ACTIVO" },
      select: { id: true, vehiculoId: true, puestoId: true, reservaId: true, fechaEntrada: true },
    });
    if (!ingresoActual) throw new AppError("El ingreso ya fue finalizado por otra operación", 409);
    if (ingresoActual.vehiculoId !== ingreso.vehiculoId || ingresoActual.puestoId !== ingreso.puestoId) {
      throw new AppError("La asignación del ingreso cambió mientras se procesaba. Actualiza e inténtalo de nuevo.", 409);
    }

    const planesActuales = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT "id"
      FROM "Mensualidad"
      WHERE "vehiculoId" = ${ingresoActual.vehiculoId}
        AND "estado" = 'ACTIVA'
        AND "fechaInicio" <= ${fechaSalida}
        AND "fechaFin" >= ${fechaSalida}
        AND ("puestoId" IS NULL OR "puestoId" = ${ingresoActual.puestoId})
      FOR UPDATE
    `;
    if (planesActuales.length === 0) throw new AppError("La mensualidad dejó de estar vigente. Registre la salida con cobro desde Ingresos.", 409);

    const finalizado = await tx.ingreso.updateMany({
      where: { id: Number(id), estado: "ACTIVO" },
      data: { fechaSalida, estado: "FINALIZADO", tiempoMinutos, valorPagado: 0 },
    });
    if (finalizado.count !== 1) throw new AppError("El ingreso ya fue finalizado por otra operación", 409);

    if (ingresoActual.reservaId) {
      await tx.reserva.updateMany({
        where: { id: ingresoActual.reservaId, estado: "ACTIVA" },
        data: { estado: "FINALIZADA" },
      });
    }

    const [otroIngresoActivo, mensualidadVigenteEnPuesto, reservaFutura] = await Promise.all([
      tx.ingreso.count({ where: { puestoId: ingreso.puestoId, estado: "ACTIVO", id: { not: Number(id) } } }),
      tx.mensualidad.count({
        where: {
          puestoId: ingreso.puestoId,
          estado: "ACTIVA",
          fechaInicio: { lte: fechaSalida },
          fechaFin: { gte: fechaSalida },
        },
      }),
      tx.reserva.count({
        where: {
          puestoId: ingreso.puestoId,
          estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
          ...(ingreso.reservaId ? { id: { not: ingreso.reservaId } } : {}),
          OR: [{ fechaFin: null }, { fechaFin: { gte: fechaSalida } }],
        },
      }),
    ]);
    const estadoPuesto = otroIngresoActivo > 0
      ? "OCUPADO"
      : mensualidadVigenteEnPuesto + reservaFutura > 0 ? "RESERVADO" : "LIBRE";
    await tx.puesto.update({ where: { id: ingreso.puestoId }, data: { estado: estadoPuesto } });
  });
  await registrarMovimiento("INGRESOS", "LIBERAR", `Ingreso #${id} finalizado — plan activo, puesto físicamente libre (asignación de plan preservada)`, req.usuario?.usuario || "admin");

  res.json({ ok: true, message: "Ingreso finalizado — plan activo, puesto físicamente libre. La asignación del plan se conserva." });
});

export const actualizarIngreso = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { vehiculoId, puestoId } = req.body;

  const ingreso = await prisma.ingreso.findUnique({ where: { id: Number(id) }, include: { cliente: true, vehiculo: true } });
  if (!ingreso) throw new AppError("Ingreso no encontrado", 404);
  if (ingreso.estado !== "ACTIVO") throw new AppError("Solo se puede editar un ingreso activo", 400);

  const vid = vehiculoId !== undefined ? Number(vehiculoId) : ingreso.vehiculoId;
  const nuevoPuestoId = puestoId !== undefined ? Number(puestoId) : ingreso.puestoId;
  if (ingreso.reservaId && (vid !== ingreso.vehiculoId || nuevoPuestoId !== ingreso.puestoId)) {
    throw new AppError("Este ingreso está vinculado a una reserva. Modifica la reserva para conservar la trazabilidad de la asignación.", 409);
  }
  if (!Number.isInteger(vid) || vid <= 0) throw new AppError("Vehículo no válido", 400);
  if (!Number.isInteger(nuevoPuestoId) || nuevoPuestoId <= 0) throw new AppError("Puesto no válido", 400);

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vid } });
  if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
  if (vehiculo.clienteId !== ingreso.clienteId) throw new AppError("El vehículo no pertenece al cliente de este ingreso", 400);
  if (vehiculo.bloqueado) throw new AppError("El vehículo está bloqueado", 400);
  if (!vehiculo.estado) throw new AppError("El vehículo está inactivo", 400);

  const actualizado = await prisma.$transaction(async (tx) => {
    // Bloquear vehículo y ambos puestos evita colisiones al editar un ingreso activo.
    // Bloquea vehículo anterior/nuevo y puestos anterior/nuevo en orden estable.
    // Así se evitan entradas duplicadas y deadlocks al intercambiar asignaciones.
    for (const lockVehiculoId of [...new Set([ingreso.vehiculoId, vid])].sort((a, b) => a - b)) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124021, ${lockVehiculoId})`;
    }
    for (const lockPuestoId of [...new Set([ingreso.puestoId, nuevoPuestoId])].sort((a, b) => a - b)) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124020, ${lockPuestoId})`;
    }

    const ingresoActual = await tx.ingreso.findUnique({
      where: { id: Number(id) },
      select: { estado: true, vehiculoId: true, puestoId: true },
    });
    if (!ingresoActual || ingresoActual.estado !== "ACTIVO") throw new AppError("El ingreso ya no está activo", 409);
    if (ingresoActual.vehiculoId !== ingreso.vehiculoId || ingresoActual.puestoId !== ingreso.puestoId) {
      throw new AppError("La asignación del ingreso cambió. Actualiza e inténtalo de nuevo.", 409);
    }

    const duplicado = await tx.ingreso.findFirst({
      where: { vehiculoId: vid, estado: "ACTIVO", id: { not: Number(id) } },
      select: { id: true },
    });
    if (duplicado) throw new AppError("El vehículo ya tiene otro ingreso activo", 409);

    if (vid !== ingreso.vehiculoId || nuevoPuestoId !== ingreso.puestoId) {
      const ahora = new Date();
      const [reservaVehiculo, mensualidadAsignada] = await Promise.all([
        tx.reserva.findFirst({
          where: {
            vehiculoId: vid,
            estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            fechaInicio: { lte: ahora },
            OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }],
          },
          select: { id: true, puestoId: true },
        }),
        tx.mensualidad.findFirst({
          where: {
            vehiculoId: vid,
            estado: "ACTIVA",
            fechaInicio: { lte: ahora },
            fechaFin: { gte: ahora },
            puestoId: { not: null },
          },
          select: { id: true, puestoId: true },
        }),
      ]);
      if (reservaVehiculo) throw new AppError("El vehículo tiene una reserva vigente. No se puede cambiar su asignación desde un ingreso activo.", 409);
      if (mensualidadAsignada?.puestoId && mensualidadAsignada.puestoId !== nuevoPuestoId) {
        throw new AppError("El vehículo tiene otro puesto asignado por su mensualidad", 409);
      }
    }

    if (nuevoPuestoId !== ingreso.puestoId) {
      const disponible = await puestoEstaDisponibleParaAsignar(tx, nuevoPuestoId, { vehiculoId: vid });
      if (!disponible) throw new AppError("El nuevo puesto ya no está disponible", 409);
      const reservado = await tx.puesto.updateMany({
        where: { id: nuevoPuestoId, activo: true, estado: { in: ["LIBRE", "RESERVADO"] } },
        data: { estado: "OCUPADO" },
      });
      if (reservado.count !== 1) throw new AppError("El nuevo puesto acaba de ser asignado. Actualiza e inténtalo de nuevo.", 409);
    }

    const result = await tx.ingreso.update({
      where: { id: Number(id) },
      data: { vehiculoId: vid, puestoId: nuevoPuestoId },
      include: { cliente: true, vehiculo: true, puesto: true },
    });

    if (nuevoPuestoId !== ingreso.puestoId) {
      const [otrosIngresos, mensualidades, reservas] = await Promise.all([
        tx.ingreso.count({ where: { puestoId: ingreso.puestoId, estado: "ACTIVO", id: { not: Number(id) } } }),
        tx.mensualidad.count({
          where: { puestoId: ingreso.puestoId, estado: "ACTIVA", fechaInicio: { lte: new Date() }, fechaFin: { gte: new Date() } },
        }),
        tx.reserva.count({
          where: {
            puestoId: ingreso.puestoId,
            estado: { in: ["PENDIENTE", "CONFIRMADA"] },
            OR: [{ fechaFin: null }, { fechaFin: { gte: new Date() } }],
          },
        }),
      ]);
      const estadoAnterior = otrosIngresos > 0 ? "OCUPADO" : mensualidades + reservas > 0 ? "RESERVADO" : "LIBRE";
      await tx.puesto.update({ where: { id: ingreso.puestoId }, data: { estado: estadoAnterior } });
    }

    return result;
  });

  await registrarMovimiento("INGRESOS", "EDITAR", `Ingreso #${id} editado`, req.usuario?.usuario || "admin");
  res.json({ ok: true, ingreso: actualizado });
});

export const eliminarIngreso = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ingreso = await prisma.ingreso.findUnique({
    where: { id: Number(id) },
    include: { facturas: { select: { id: true, numero: true } } },
  });
  if (!ingreso) throw new AppError("Ingreso no encontrado", 404);
  if (ingreso.estado === "ACTIVO") throw new AppError("No se puede eliminar un ingreso activo. Finalícelo primero.", 400);
  if (ingreso.facturas.length > 0) {
    throw new AppError("Este ingreso tiene facturas emitidas. No se puede eliminar porque forma parte del historial financiero; conserva el registro para auditoría.", 409);
  }

  await prisma.$transaction(async (tx) => {
    if (ingreso.puestoId) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124020, ${ingreso.puestoId})`;
    }
    const actual = await tx.ingreso.findUnique({ where: { id: Number(id) } });
    if (!actual || actual.estado === "ACTIVO") {
      throw new AppError("El ingreso cambió de estado y ya no puede eliminarse", 409);
    }
    if (actual.puestoId !== ingreso.puestoId) {
      throw new AppError("El puesto del ingreso cambió. Actualiza la lista antes de eliminarlo.", 409);
    }
    await tx.ingreso.delete({ where: { id: Number(id) } });
    if (ingreso.puestoId) {
      const ahora = new Date();
      const [otrosIngresos, mensualidades, reservas] = await Promise.all([
        tx.ingreso.count({ where: { puestoId: ingreso.puestoId, estado: "ACTIVO" } }),
        tx.mensualidad.count({ where: { puestoId: ingreso.puestoId, estado: "ACTIVA", fechaInicio: { lte: ahora }, fechaFin: { gte: ahora } } }),
        tx.reserva.count({
          where: {
            puestoId: ingreso.puestoId,
            estado: { in: ["PENDIENTE", "CONFIRMADA"] },
            OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }],
          },
        }),
      ]);
      const estadoPuesto = otrosIngresos > 0 ? "OCUPADO" : mensualidades + reservas > 0 ? "RESERVADO" : "LIBRE";
      await tx.puesto.update({ where: { id: ingreso.puestoId }, data: { estado: estadoPuesto } });
    }
  });
  await registrarMovimiento("INGRESOS", "ELIMINAR", `Ingreso #${id} eliminado`, req.usuario?.usuario || "admin");
  res.json({ ok: true, message: "Ingreso eliminado correctamente" });
});

export const simularCobro = asyncHandler(async (req, res) => {
  const { ingresoId, ticketExtraviado } = req.body;
  if (!ingresoId) throw new AppError("ingresoId es requerido", 400);

  const ingreso = await prisma.ingreso.findUnique({
    where: { id: Number(ingresoId) },
    include: { vehiculo: true, cliente: true, puesto: true, facturas: true },
  });
  if (!ingreso) throw new AppError("Ingreso no encontrado", 404);
  if (ingreso.estado === "FINALIZADO") throw new AppError("Este ingreso ya fue finalizado", 400);

  const planActivo = await prisma.mensualidad.findFirst({
    where: {
      vehiculoId: ingreso.vehiculoId,
      estado: "ACTIVA",
      fechaInicio: { lte: new Date() },
      fechaFin: { gte: new Date() },
      OR: [{ puestoId: null }, { puestoId: ingreso.puestoId }],
    },
    include: { plan: true },
  });
  if (planActivo) {
    const totalMinutos = Math.ceil((Date.now() - new Date(ingreso.fechaEntrada).getTime()) / 60000);
    return res.json({ ok: true, cobro: { total: 0, totalMinutos, error: null, plan: planActivo.plan?.nombre || "Plan activo" }, ingreso });
  }

  await getCajaOError();

  const cobro = await calcularCobro({
    ingreso,
    tipoVehiculo: ingreso.vehiculo.tipo || undefined,
    ticketExtraviado,
    tarifaId: ingreso.vehiculo.tarifaId ?? undefined,
  });

  if (cobro.error) throw new AppError(cobro.error, 400);

  const saldoDisponible = Math.max(0, ingreso.cliente?.saldo ?? 0);
  const saldoUsado = Math.min(saldoDisponible, cobro.total);
  const totalPorPagar = Math.max(0, cobro.total - saldoUsado);

  res.json({
    ok: true,
    cobro: {
      ...cobro,
      totalBruto: cobro.total,
      saldoUsado,
      total: totalPorPagar,
    },
    ingreso,
  });
});

export const registrarSalidaConCobro = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { metodoPago, ticketExtraviado } = req.body;

  const ingreso = await prisma.ingreso.findUnique({
    where: { id: Number(id) },
    include: { cliente: true, vehiculo: { include: { tarifa: true, plan: true } }, puesto: true },
  });
  if (!ingreso) throw new AppError("Ingreso no encontrado", 404);
  if (ingreso.estado === "FINALIZADO") throw new AppError("Este ingreso ya fue finalizado", 400);

  let fechaSalida = new Date();
  const mp = metodoPago || "efectivo";

  const ahora = new Date();

  const mensualidadVigente = await prisma.mensualidad.findFirst({
    where: {
      vehiculoId: ingreso.vehiculoId,
      estado: "ACTIVA",
      fechaInicio: { lte: ahora },
      fechaFin: { gte: ahora },
      // La mensualidad solo cubre el puesto que tiene asignado (o todos si no fija uno).
      OR: [{ puestoId: null }, { puestoId: ingreso.puestoId }],
    },
    include: { plan: true, puesto: true },
  });

  let cobroTotal = 0;
  let cobroTotalMinutos = 0;
  let cubiertoPorPlan = false;

  if (mensualidadVigente) {
    cubiertoPorPlan = true;
    cobroTotalMinutos = Math.ceil((fechaSalida.getTime() - new Date(ingreso.fechaEntrada).getTime()) / 60000);
  } else {
    await getCajaOError();
    const cobro = await calcularCobro({
      ingreso,
      tipoVehiculo: ingreso.vehiculo.tipo || undefined,
      fechaSalida,
      ticketExtraviado,
      tarifaId: ingreso.vehiculo.tarifaId ?? undefined,
    });
    if (cobro.error) throw new AppError(cobro.error, 400);
    cobroTotal = cobro.total;
    cobroTotalMinutos = cobro.totalMinutos ?? 0;
  }

  // El saldo se calcula dentro de la transacción, después de bloquear el registro
  // del cliente. Así dos salidas simultáneas no pueden consumir el mismo crédito.
  let valorFinal = cobroTotal;
  let saldoUsado = 0;

  const numeroFactura = cubiertoPorPlan ? null : await generarNumeroFactura("FACT");

  let facturaCreada: any = null;
  const [salida, factura] = await prisma.$transaction(async (tx) => {
    // Usa los mismos bloqueos que el registro de entrada para serializar la ocupación.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124021, ${ingreso.vehiculoId})`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124020, ${ingreso.puestoId})`;
    // El cierre de caja usa este mismo bloqueo: no puede cerrar mientras se registra un cobro.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124019)`;
    // La hora efectiva se fija después de obtener los bloqueos, no antes de esperar.
    fechaSalida = new Date();
    if (cubiertoPorPlan) {
      cobroTotalMinutos = Math.ceil((fechaSalida.getTime() - new Date(ingreso.fechaEntrada).getTime()) / 60000);
    }

    const ingresoActual = await tx.ingreso.findUnique({
      where: { id: Number(id) },
      select: { estado: true, vehiculoId: true, puestoId: true, reservaId: true },
    });
    if (!ingresoActual || ingresoActual.estado !== "ACTIVO") {
      throw new AppError("El ingreso ya fue finalizado por otra operación", 409);
    }
    if (ingresoActual.vehiculoId !== ingreso.vehiculoId || ingresoActual.puestoId !== ingreso.puestoId || ingresoActual.reservaId !== ingreso.reservaId) {
      throw new AppError("La asignación del ingreso cambió mientras se procesaba. Vuelve a simular la salida.", 409);
    }

    // La cobertura del plan puede cambiar entre la simulación y la confirmación.
    // Si cambió, no se cobra ni se libera el vehículo con una regla desactualizada.
    const mensualidadesBloqueadas = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT "id"
      FROM "Mensualidad"
      WHERE "vehiculoId" = ${ingreso.vehiculoId}
        AND "estado" = 'ACTIVA'
        AND "fechaInicio" <= ${fechaSalida}
        AND "fechaFin" >= ${fechaSalida}
        AND ("puestoId" IS NULL OR "puestoId" = ${ingreso.puestoId})
      FOR UPDATE
    `;
    if ((mensualidadesBloqueadas.length > 0) !== cubiertoPorPlan) {
      throw new AppError("La cobertura de la mensualidad cambió durante la operación. Vuelve a simular el cobro.", 409);
    }

    // Recalcula con la hora efectiva de salida tras esperar los bloqueos.
    if (!cubiertoPorPlan) {
      const cobroActual = await calcularCobro({
        ingreso,
        tipoVehiculo: ingreso.vehiculo.tipo || undefined,
        fechaSalida,
        ticketExtraviado,
        tarifaId: ingreso.vehiculo.tarifaId ?? undefined,
      });
      if (cobroActual.error) throw new AppError(cobroActual.error, 400);
      cobroTotal = cobroActual.total;
      cobroTotalMinutos = cobroActual.totalMinutos ?? 0;

      // Bloquea y lee el saldo actual para evitar consumir crédito ya utilizado.
      if (ingreso.clienteId) {
        await tx.$queryRaw`SELECT "id" FROM "Cliente" WHERE "id" = ${ingreso.clienteId} FOR UPDATE`;
        const clienteActual = await tx.cliente.findUnique({
          where: { id: ingreso.clienteId },
          select: { saldo: true },
        });
        const saldoDisponible = clienteActual?.saldo ?? 0;
        saldoUsado = Math.min(Math.max(0, saldoDisponible), cobroTotal);
      }
      valorFinal = Math.max(0, cobroTotal - saldoUsado);
    }

    const salidaActualizada = await tx.ingreso.updateMany({
      where: { id: Number(id), estado: "ACTIVO" },
      data: {
        fechaSalida,
        estado: "FINALIZADO",
        tiempoMinutos: cobroTotalMinutos,
        valorPagado: cubiertoPorPlan ? 0 : valorFinal,
        ...(ticketExtraviado ? { ticketExtraviado: true } : {}),
      },
    });
    if (salidaActualizada.count !== 1) {
      throw new AppError("La salida ya fue registrada por otro usuario. Actualiza la lista antes de continuar.", 409);
    }
    const s = await tx.ingreso.findUniqueOrThrow({
      where: { id: Number(id) },
      include: { cliente: true, vehiculo: true, puesto: true },
    });

    const [otroIngresoActivo, mensualidadEnPuesto, reservaFutura] = await Promise.all([
      tx.ingreso.count({ where: { puestoId: ingreso.puestoId, estado: "ACTIVO", id: { not: Number(id) } } }),
      tx.mensualidad.count({
        where: { puestoId: ingreso.puestoId, estado: "ACTIVA", fechaInicio: { lte: fechaSalida }, fechaFin: { gte: fechaSalida } },
      }),
      tx.reserva.count({
        where: {
          puestoId: ingreso.puestoId,
          estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
          ...(ingreso.reservaId ? { id: { not: ingreso.reservaId } } : {}),
          OR: [{ fechaFin: null }, { fechaFin: { gte: fechaSalida } }],
        },
      }),
    ]);
    const nuevoEstadoPuesto = otroIngresoActivo > 0 ? "OCUPADO" : mensualidadEnPuesto + reservaFutura > 0 ? "RESERVADO" : "LIBRE";
    await tx.puesto.update({ where: { id: ingreso.puestoId }, data: { estado: nuevoEstadoPuesto } });

    if (ingreso.reservaId) {
      await tx.reserva.update({ where: { id: ingreso.reservaId }, data: { estado: "FINALIZADA" } });
    }

    if (!cubiertoPorPlan) {
      if (saldoUsado > 0 && ingreso.clienteId) {
        await tx.cliente.update({ where: { id: ingreso.clienteId }, data: { saldo: { decrement: saldoUsado } } });
      }
      const f = await tx.factura.create({
        data: { numero: String(numeroFactura), ingresoId: ingreso.id, origen: "INGRESO", valor: valorFinal, metodoPago: mp },
      });
      facturaCreada = f;
      const cajaAbierta = await tx.caja.findFirst({ where: { estado: "ABIERTA" } });
      if (!cajaAbierta) throw new AppError("No hay caja abierta", 400);
      const conceptoExtra = ticketExtraviado ? " [TICKET EXTRAVIADO]" : "";
      await tx.cajaMovimiento.create({
        data: { cajaId: cajaAbierta.id, tipo: "INGRESO", concepto: `Factura ${numeroFactura} — Salida ${ingreso.vehiculo.placa}${conceptoExtra}`, monto: valorFinal, metodoPago: mp, facturaId: f.id },
      });
    }

    return [s, cubiertoPorPlan ? null : facturaCreada];
  });

  if (!cubiertoPorPlan) {
    await registrarMovimiento("FACTURACION", "CREAR", `Factura ${numeroFactura} por $${valorFinal}${ticketExtraviado ? " (ticket extraviado)" : ""}${saldoUsado > 0 ? ` (saldo usado: $${saldoUsado})` : ""}`, req.usuario?.usuario || "admin");
    const cajaResp = await getCajaAbierta();
    emitirEvento("ingreso:salida", {
      mensaje: `Vehículo ${ingreso.vehiculo.placa} salió — Factura ${numeroFactura} por $${valorFinal}${ticketExtraviado ? " (ticket extraviado)" : ""}`,
      factura: facturaCreada, ingreso: salida, valor: valorFinal,
    });
    res.json({ ok: true, message: "Salida registrada", cobro: { total: valorFinal, totalMinutos: cobroTotalMinutos, saldoUsado }, factura: facturaCreada, salida, caja: cajaResp });
  } else {
    await registrarMovimiento("INGRESOS", "SALIDA", `Salida ${ingreso.vehiculo.placa} — mensualidad vigente, sin cobro adicional`, req.usuario?.usuario || "admin");
    res.json({ ok: true, message: "Salida registrada — salida cubierta por mensualidad vigente, no se generó cobro adicional", salida, cobro: { total: 0, totalMinutos: cobroTotalMinutos, cubiertoPorPlan: true, plan: mensualidadVigente?.plan?.nombre || "Plan mensual" } });
  }
});

export const ticketEntrada = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const factura = await prisma.factura.findFirst({
    where: { ingresoId: Number(id) },
    include: { ingreso: { include: { vehiculo: { include: { cliente: true } }, puesto: true } } },
    orderBy: { createdAt: 'desc' },
  });

  let ing;
  let folio;
  if (factura?.ingreso) {
    ing = factura.ingreso;
    folio = factura.numero;
  } else {
    ing = await prisma.ingreso.findUnique({
      where: { id: Number(id) },
      include: { vehiculo: { include: { cliente: true } }, puesto: true },
    });
    if (!ing) throw new AppError('Ingreso no encontrado', 404);
    folio = `ING-${String(ing.id).padStart(6, '0')}`;
  }

  const config = await prisma.configuracion.findFirst();
  const cliente = ing.vehiculo?.cliente;
  const pdf = await generarTicketPDF({
    titulo: 'TICKET DE ENTRADA',
    tipo: 'entrada',
    folio,
    placa: ing.vehiculo?.placa || '\u2014',
    cliente: [cliente?.nombres, cliente?.apellidos].filter(Boolean).join(' ') || '',
    clienteDoc: cliente?.documento || '',
    clienteTelefono: cliente?.telefono || '',
    vehiculo: `${ing.vehiculo?.marca || ''} ${ing.vehiculo?.modelo || ''}`.trim() || ing.vehiculo?.tipo || '',
    vehiculoTipo: ing.vehiculo?.tipo || '',
    vehiculoMarca: ing.vehiculo?.marca || '',
    vehiculoModelo: ing.vehiculo?.modelo || '',
    ingreso: ing.fechaEntrada ? new Date(ing.fechaEntrada).toLocaleString('es-CO') : '',
    puesto: ing.puesto?.codigo || '',
    parqueadero: config?.nombreParqueadero || 'Parqueadero',
    direccion: config?.direccion ?? undefined,
    telefono: config?.telefono ?? undefined,
    correo: config?.correo ?? undefined,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="ticket-${folio}.pdf"`);
  res.send(pdf);
});

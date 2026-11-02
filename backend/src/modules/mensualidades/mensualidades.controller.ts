import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { generarNumeroFactura } from "../../services/facturaCounter.js";

export const crearMensualidad = asyncHandler(async (req, res) => {
  const { clienteId, vehiculoId, puestoId, planId, fechaInicio, fechaFin, valor, observacion } = req.body;
  const cid = Number(clienteId);
  const vid = Number(vehiculoId);

  const cliente = await prisma.cliente.findUnique({ where: { id: cid } });
  if (!cliente) throw new AppError("Cliente no encontrado", 404);
  if (cliente.bloqueado) throw new AppError("El cliente está bloqueado", 400);

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vid } });
  if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
  if (vehiculo.clienteId !== cid) throw new AppError("El vehículo no pertenece al cliente seleccionado", 400);
  if (vehiculo.bloqueado) throw new AppError("El vehículo está bloqueado", 400);
  if (!vehiculo.estado) throw new AppError("El vehículo está inactivo", 400);

  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) throw new AppError("Fecha inválida", 400);
  if (fin <= inicio) throw new AppError("La fecha fin debe ser posterior a la fecha inicio", 400);

  let plan = null;
  let monto = Number(valor);
  if (planId) {
    plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
    if (!plan || !plan.activo) throw new AppError("Plan no encontrado o inactivo", 400);
    monto = plan.valor;
  }

  let puesto = null;
  if (puestoId) {
    puesto = await prisma.puesto.findUnique({ where: { id: Number(puestoId) } });
    if (!puesto) throw new AppError("Puesto no encontrado", 404);
    if (!puesto.activo) throw new AppError("El puesto está inactivo", 400);
    if (puesto.estado !== "LIBRE") throw new AppError("El puesto no está disponible (estado: " + puesto.estado + ")", 400);
  }

  const ingresoActivo = await prisma.ingreso.findFirst({ where: { vehiculoId: vid, estado: "ACTIVO" } });
  if (ingresoActivo && (!puesto || ingresoActivo.puestoId !== puesto.id)) {
    throw new AppError("El vehículo ya tiene un ingreso activo en otro puesto", 400);
  }

  const data = { fechaInicio: inicio, fechaFin: fin, observacion, valor: monto };

  const mensualidad = await prisma.$transaction(async (tx) => {
    const m = await tx.mensualidad.create({
      data: { clienteId: cid, vehiculoId: vid, planId: plan ? Number(planId) : undefined, puestoId: puesto ? Number(puestoId) : undefined, ...data },
      include: { cliente: true, vehiculo: true, plan: true, puesto: true },
    });
    if (puesto) {
      await tx.puesto.update({ where: { id: Number(puestoId) }, data: { estado: "OCUPADO" } });
      const ingresoExistente = await tx.ingreso.findFirst({ where: { vehiculoId: vid, estado: "ACTIVO" } });
      if (!ingresoExistente) {
        await tx.ingreso.create({ data: { clienteId: cid, vehiculoId: vid, puestoId: Number(puestoId) } });
      }
    }
    return m;
  });
  await registrarMovimiento("MENSUALIDADES", "CREAR", `Mensualidad creada para ${mensualidad.cliente.nombres}`, req.usuario?.usuario);
  res.status(201).json({ ok: true, mensualidad });
});
export const obtenerMensualidades = asyncHandler(async (req, res) => {
  const { page, limit, estado, q } = req.query;
  const where = {};
  if (estado) where.estado = estado;
  if (q) {
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
    const pagadoPeriodo = m.facturas
      .filter((f) => new Date(f.createdAt) >= new Date(m.fechaInicio))
      .reduce((sum, f) => sum + f.valor, 0);
    return { ...m, saldoPendiente: Math.max(0, m.valor - pagadoPeriodo), ausente: activasSet.has(m.vehiculoId) };
  });

  res.json({ ok: true, mensualidades: result, pagination });
});

export const obtenerMensualidad = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const mensualidad = await prisma.mensualidad.findUnique({
    where: { id: Number(id) },
    include: { cliente: true, vehiculo: true, plan: true, puesto: true, facturas: true },
  });
  if (!mensualidad) throw new AppError("Mensualidad no encontrada", 404);
  const ausenciaActiva = mensualidad.vehiculoId ? await prisma.ausencia.findFirst({
    where: { vehiculoId: mensualidad.vehiculoId, estado: "ACTIVA" },
  }) : null;
  const pagadoPeriodo = mensualidad.facturas
    .filter((f) => new Date(f.createdAt) >= new Date(mensualidad.fechaInicio))
    .reduce((sum, f) => sum + f.valor, 0);
  res.json({ ok: true, mensualidad: { ...mensualidad, saldoPendiente: Math.max(0, mensualidad.valor - pagadoPeriodo), ausente: !!ausenciaActiva, ausencia: ausenciaActiva } });
});

export const obtenerVencidas = asyncHandler(async (req, res) => {
  const hoy = new Date();
  const vencidas = await prisma.mensualidad.findMany({
    where: { fechaFin: { lt: hoy }, estado: "ACTIVA" },
    include: { cliente: true, vehiculo: true, plan: true, puesto: true },
  });
  res.json({ ok: true, vencidas });
});

export const renovarMensualidad = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const mensualidad = await prisma.mensualidad.findUnique({ where: { id: Number(id) } });
  if (!mensualidad) throw new AppError("Mensualidad no encontrada", 404);

  const fechaInicio = new Date();
  const fechaFin = new Date();
  fechaFin.setMonth(fechaFin.getMonth() + 1);

  const renovada = await prisma.mensualidad.update({
    where: { id: Number(id) },
    data: { fechaInicio, fechaFin, estado: "ACTIVA" },
  });
  res.json({ ok: true, renovada });
});

export const actualizarMensualidad = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { vehiculoId, planId, puestoId, fechaInicio, fechaFin, valor, observacion } = req.body;
  const existente = await prisma.mensualidad.findUnique({ where: { id: Number(id) } });
  if (!existente) throw new AppError("Mensualidad no encontrada", 404);

  const data: any = { observacion, valor: valor !== undefined ? Number(valor) : existente.valor };
  if (fechaInicio) data.fechaInicio = new Date(fechaInicio);
  if (fechaFin) data.fechaFin = new Date(fechaFin);
  if (vehiculoId !== undefined) data.vehiculoId = vehiculoId ? Number(vehiculoId) : existente.vehiculoId;
  if (planId !== undefined) data.planId = planId ? Number(planId) : null;

  const vid = data.vehiculoId ?? existente.vehiculoId;
  const cid = existente.clienteId;

  if (vehiculoId !== undefined) {
    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vid } });
    if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
    if (vehiculo.clienteId !== cid) throw new AppError("El vehículo no pertenece al cliente de esta mensualidad", 400);
    if (vehiculo.bloqueado) throw new AppError("El vehículo está bloqueado", 400);
  }

  const inicio = data.fechaInicio ? new Date(data.fechaInicio) : existente.fechaInicio;
  const fin = data.fechaFin ? new Date(data.fechaFin) : existente.fechaFin;
  if (fin <= inicio) throw new AppError("La fecha fin debe ser posterior a la fecha inicio", 400);

  const actualizada = await prisma.$transaction(async (tx) => {
    if (puestoId !== undefined) {
      const nuevoPuestoId = puestoId ? Number(puestoId) : null;
      if (nuevoPuestoId !== existente.puestoId) {
        const ingresosActivosPuesto = await tx.ingreso.count({ where: { puestoId: existente.puestoId, estado: "ACTIVO" } });
        if (existente.puestoId && ingresosActivosPuesto === 0) {
          const mensualidadActivaPuesto = await tx.mensualidad.count({ where: { puestoId: existente.puestoId, estado: "ACTIVA", id: { not: Number(id) } } });
          const reservaActivaPuesto = await tx.reserva.count({ where: { puestoId: existente.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] } } });
          if (mensualidadActivaPuesto === 0 && reservaActivaPuesto === 0) {
            await tx.puesto.update({ where: { id: existente.puestoId }, data: { estado: "LIBRE" } });
          }
        }
        if (nuevoPuestoId) {
          const nuevoPuesto = await tx.puesto.findUnique({ where: { id: nuevoPuestoId } });
          if (!nuevoPuesto) throw new AppError("Puesto no encontrado", 404);
          if (!nuevoPuesto.activo) throw new AppError("El puesto está inactivo", 400);
          if (nuevoPuesto.estado !== "LIBRE") throw new AppError("El puesto no está disponible (estado: " + nuevoPuesto.estado + ")", 400);
          await tx.puesto.update({ where: { id: nuevoPuestoId }, data: { estado: "OCUPADO" } });
          const ingresoExistente = await tx.ingreso.findFirst({ where: { vehiculoId: vid, estado: "ACTIVO" } });
          if (!ingresoExistente) {
            await tx.ingreso.create({ data: { clienteId: cid, vehiculoId: vid, puestoId: nuevoPuestoId } });
          }
        }
      }
      data.puestoId = nuevoPuestoId;
    }
    return tx.mensualidad.update({
      where: { id: Number(id) },
      data,
      include: { cliente: true, vehiculo: true, plan: true, puesto: true },
    });
  });
  await registrarMovimiento("MENSUALIDADES", "EDITAR", `Mensualidad #${id} editada`, req.usuario?.usuario);
  res.json({ ok: true, mensualidad: actualizada });
});

export const cancelarMensualidad = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existente = await prisma.mensualidad.findUnique({ where: { id: Number(id) } });
  if (!existente) throw new AppError("Mensualidad no encontrada", 404);
  if (existente.estado !== "ACTIVA") throw new AppError("Solo se puede cancelar una mensualidad activa", 400);

  const cancelada = await prisma.$transaction(async (tx) => {
    const c = await tx.mensualidad.update({
      where: { id: Number(id) },
      data: { estado: "CANCELADA" },
      include: { cliente: true, vehiculo: true, plan: true, puesto: true },
    });
    if (existente.puestoId) {
      const ingresoActivo = await tx.ingreso.count({ where: { puestoId: existente.puestoId, estado: "ACTIVO" } });
      const otraMensualidad = await tx.mensualidad.count({ where: { puestoId: existente.puestoId, estado: "ACTIVA", id: { not: Number(id) } } });
      const reservaActiva = await tx.reserva.count({ where: { puestoId: existente.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] } } });
      if (ingresoActivo === 0 && otraMensualidad === 0 && reservaActiva === 0) {
        await tx.puesto.update({ where: { id: existente.puestoId }, data: { estado: "LIBRE" } });
      }
    }
    return c;
  });
  await registrarMovimiento("MENSUALIDADES", "CANCELAR", `Mensualidad #${id} cancelada`, req.usuario?.usuario);
  res.json({ ok: true, mensualidad: cancelada });
});

export const eliminarMensualidad = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existente = await prisma.mensualidad.findUnique({
    where: { id: Number(id) },
    include: { facturas: { select: { id: true, numero: true } } },
  });
  if (!existente) throw new AppError("Mensualidad no encontrada", 404);
  if (existente.estado === "ACTIVA") throw new AppError("No se puede eliminar una mensualidad activa. Cáncela primero.", 400);
  if (existente.facturas.length > 0) {
    throw new AppError("Esta mensualidad tiene facturas emitidas. No se puede eliminar porque forma parte del historial financiero; utiliza la cancelación para conservar la auditoría.", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.mensualidad.delete({ where: { id: Number(id) } });
    if (existente.puestoId) {
      const ahora = new Date();
      const [ingresos, mensualidades, reservas] = await Promise.all([
        tx.ingreso.count({ where: { puestoId: existente.puestoId, estado: "ACTIVO" } }),
        tx.mensualidad.count({ where: { puestoId: existente.puestoId, estado: "ACTIVA", fechaInicio: { lte: ahora }, fechaFin: { gte: ahora } } }),
        tx.reserva.count({
          where: {
            puestoId: existente.puestoId,
            estado: { in: ["PENDIENTE", "CONFIRMADA"] },
            OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }],
          },
        }),
      ]);
      const estadoPuesto = ingresos > 0 ? "OCUPADO" : mensualidades + reservas > 0 ? "RESERVADO" : "LIBRE";
      await tx.puesto.update({ where: { id: existente.puestoId }, data: { estado: estadoPuesto } });
    }
  });
  await registrarMovimiento("MENSUALIDADES", "ELIMINAR", `Mensualidad #${id} eliminada`, req.usuario?.usuario);
  res.json({ ok: true, message: "Mensualidad eliminada correctamente" });
});

export const cobrarMensualidad = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { metodoPago, monto } = req.body;
  const mp = metodoPago || "efectivo";
  if (typeof mp !== "string" || !mp.trim() || mp.trim().length > 60) {
    throw new AppError("El método de pago no es válido", 400);
  }

  const resultado = await prisma.$transaction(async (tx) => {
    // Bloquea la mensualidad para que dos abonos simultáneos no excedan su saldo.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124018, ${Number(id)}::integer)`;
    await tx.$queryRaw`SELECT id FROM "Mensualidad" WHERE id = ${Number(id)} FOR UPDATE`;

    // El mismo bloqueo global de caja se usa al abrir, cerrar y registrar otros movimientos.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124019)`;

    const mensualidad = await tx.mensualidad.findUnique({
      where: { id: Number(id) },
      include: { plan: true },
    });
    if (!mensualidad) throw new AppError("Mensualidad no encontrada", 404);
    if (mensualidad.estado !== "ACTIVA") throw new AppError("La mensualidad no está activa", 400);

    const pagos = await tx.factura.aggregate({
      _sum: { valor: true },
      where: { mensualidadId: mensualidad.id, createdAt: { gte: mensualidad.fechaInicio } },
    });
    const saldoPendiente = Math.max(0, mensualidad.valor - (pagos._sum.valor || 0));
    const montoPagado = monto !== undefined ? Number(monto) : saldoPendiente;

    if (!Number.isFinite(montoPagado) || montoPagado <= 0) throw new AppError("El monto debe ser un número mayor a 0", 400);
    if (montoPagado > saldoPendiente) {
      throw new AppError(`El monto excede el saldo pendiente ($${saldoPendiente.toLocaleString()})`, 400);
    }

    const cajaAbierta = await tx.caja.findFirst({ where: { estado: "ABIERTA" } });
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
  const cajaActualizada = await prisma.caja.findUnique({ where: { id: resultado.cajaId } });

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
  const hoy = new Date();
  const activas = await prisma.mensualidad.findMany({
    where: { estado: "ACTIVA", fechaFin: { gte: hoy } },
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
        },
      });
    });
    generadas++;
  }

  await registrarMovimiento("FACTURACION", "GENERAR_AUTO", `${generadas} factura(s) generadas automáticamente`, req.usuario?.usuario || "admin");

  res.json({ ok: true, generadas, total: activas.length });
});

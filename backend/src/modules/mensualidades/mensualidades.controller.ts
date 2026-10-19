import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { generarNumeroFactura } from "../../services/facturaCounter.js";
import { getCajaOError } from "../../helpers/caja.js";

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
    include: { facturas: { select: { numero: true } } },
  });
  if (!existente) throw new AppError("Mensualidad no encontrada", 404);
  if (existente.estado === "ACTIVA") throw new AppError("No se puede eliminar una mensualidad activa. Cáncela primero.", 400);

  const facturaIds = existente.facturas.map(f => f.id);

  await prisma.$transaction(async (tx) => {
    if (existente.puestoId) await tx.puesto.update({ where: { id: existente.puestoId }, data: { estado: "LIBRE" } });
    await tx.cajaMovimiento.deleteMany({ where: { facturaId: { in: facturaIds } } });
    await tx.factura.deleteMany({ where: { mensualidadId: Number(id) } });
    await tx.mensualidad.delete({ where: { id: Number(id) } });
  });
  await registrarMovimiento("MENSUALIDADES", "ELIMINAR", `Mensualidad #${id} eliminada${facturaIds.length ? ` (${facturaIds.length} factura(s) anulada(s))` : ""}`, req.usuario?.usuario);
  res.json({ ok: true, message: "Mensualidad eliminada correctamente" });
});

async function getSaldoPendiente(mensualidadId, fechaInicio) {
  const pagos = await prisma.factura.aggregate({
    _sum: { valor: true },
    where: { mensualidadId, createdAt: { gte: new Date(fechaInicio) } },
  });
  return pagos._sum.valor || 0;
}

export const cobrarMensualidad = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { metodoPago, monto } = req.body;
  const existente = await prisma.mensualidad.findUnique({
    where: { id: Number(id) },
    include: { cliente: true, vehiculo: true },
  });
  if (!existente) throw new AppError("Mensualidad no encontrada", 404);
  if (existente.estado !== "ACTIVA") throw new AppError("La mensualidad no está activa", 400);

  await getCajaOError();
  const mp = metodoPago || "efectivo";

  const yaPagado = await getSaldoPendiente(existente.id, existente.fechaInicio);
  const saldoPendiente = Math.max(0, existente.valor - yaPagado);
  const montoPagado = monto !== undefined ? Number(monto) : saldoPendiente;

  if (montoPagado <= 0) throw new AppError("El monto debe ser mayor a 0", 400);
  if (montoPagado > saldoPendiente) throw new AppError(`El monto excede el saldo pendiente ($${saldoPendiente.toLocaleString()})`, 400);

  const numeroFactura = await generarNumeroFactura("FACT-MEN");

  const [factura] = await prisma.$transaction(async (tx) => {
    const f = await tx.factura.create({
      data: { numero: numeroFactura, mensualidadId: Number(id), origen: "MENSUALIDAD", valor: montoPagado, metodoPago: mp },
    });
    const cajaAbierta = await tx.caja.findFirst({ where: { estado: "ABIERTA" } });
    if (cajaAbierta) {
      await tx.cajaMovimiento.create({
        data: { cajaId: cajaAbierta.id, tipo: "INGRESO", concepto: `Factura ${numeroFactura} — Mensualidad #${id}`, monto: montoPagado, metodoPago: mp, facturaId: f.id },
      });
    }
    const nuevoSaldo = saldoPendiente - montoPagado;
    if (nuevoSaldo <= 0) {
      const fechaInicio = new Date();
      const fechaFin = new Date(fechaInicio);
      let duracionDias = 30;
      if (existente.planId) {
        const plan = await prisma.plan.findUnique({ where: { id: existente.planId } });
        if (plan) duracionDias = plan.duracionDias;
      }
      fechaFin.setDate(fechaFin.getDate() + duracionDias);
      await tx.mensualidad.update({
        where: { id: Number(id) },
        data: { fechaInicio, fechaFin, estado: "ACTIVA" },
      });
    }
    return [f];
  });

  await registrarMovimiento("FACTURACION", "CREAR", `Factura ${numeroFactura} por mensualidad #${id} — $${montoPagado}`, req.usuario?.usuario || "admin");

  const nuevoSaldoPendiente = saldoPendiente - montoPagado;
  const renovada = nuevoSaldoPendiente <= 0;
  const cajaActualizada = await prisma.caja.findFirst({ where: { estado: "ABIERTA" } });

  res.json({
    ok: true, factura, caja: cajaActualizada,
    saldoPendiente: Math.max(0, nuevoSaldoPendiente),
    renovada,
    mensaje: renovada
      ? `Pago completo — Factura ${numeroFactura}. Mensualidad renovada por 1 mes.`
      : `Abono registrado — Factura ${numeroFactura}. Saldo pendiente: $${Math.max(0, nuevoSaldoPendiente).toLocaleString()}`,
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

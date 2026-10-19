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

async function puestoEstaDisponibleParaAsignar(tx: any, puestoId: number) {
  const puesto = await tx.puesto.findUnique({ where: { id: puestoId } });
  if (!puesto || !puesto.activo || puesto.estado !== "LIBRE") return false;
  const [ingresos, mensualidades, reservas] = await Promise.all([
    tx.ingreso.count({ where: { puestoId, estado: "ACTIVO" } }),
    tx.mensualidad.count({ where: { puestoId, estado: "ACTIVA" } }),
    tx.reserva.count({ where: { puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] } } }),
  ]);
  return ingresos === 0 && mensualidades === 0 && reservas === 0;
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

  let reservaVinculada = null;
  if (!puestoId) {
    reservaVinculada = await service.buscarReservaActiva(clienteId);
    if (reservaVinculada) {
      puestoId = reservaVinculada.puestoId;
    }
  }

  if (!puestoId) throw new AppError("Debes seleccionar un puesto o tener una reserva activa", 400);

  const puesto = await prisma.puesto.findUnique({ where: { id: Number(puestoId) } });
  if (!puesto) throw new AppError("Puesto no encontrado", 404);
  if (!puesto.activo) throw new AppError("El puesto está inactivo", 400);

  const placa = req.body.placa || vehiculo.placa;
  const existenteActivo = await prisma.ingreso.findFirst({
    where: { vehiculoId: vehiculoId, estado: "ACTIVO" },
  });
  if (existenteActivo) throw new AppError(`El vehículo con placa ${placa} ya se encuentra dentro del parqueadero`, 400);

  const ingreso = await prisma.$transaction(async (tx) => {
    const disponible = await puestoEstaDisponibleParaAsignar(tx, Number(puestoId));
    if (!disponible) throw new AppError("El puesto no está disponible para asignar", 400);
    await tx.puesto.update({ where: { id: Number(puestoId) }, data: { estado: "OCUPADO" } });
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

  await registrarMovimiento("INGRESOS", "ENTRADA", `Vehículo ${ingreso.vehiculo.placa} ingresó al puesto ${puesto.codigo}${reservaVinculada ? " (reserva)" : ""}`, req.usuario?.usuario || "admin");
  emitirEvento("ingreso:entrada", { mensaje: `Vehículo ${ingreso.vehiculo.placa} ingresó al puesto ${puesto.codigo}`, cliente: ingreso.cliente, vehiculo: ingreso.vehiculo, puesto: ingreso.puesto, fecha: ingreso.fechaEntrada });

  res.status(201).json({ ok: true, ingreso, reservaAsignada: !!reservaVinculada });
});

export const obtenerIngresos = asyncHandler(async (req, res) => {
  const { page, limit, estado, clienteId, q } = req.query;
  const where = {};
  if (estado) where.estado = estado;
  if (clienteId) where.clienteId = Number(clienteId);
  if (q) {
    where.OR = [
      { cliente: { nombres: { contains: q, mode: "insensitive" } } },
      { cliente: { apellidos: { contains: q, mode: "insensitive" } } },
      { vehiculo: { placa: { contains: q, mode: "insensitive" } } },
      { puesto: { codigo: { contains: q, mode: "insensitive" } } },
    ];
  }

  const { data: ingresos, pagination } = await paginate(prisma, "ingreso", {
    page, limit, where,
    include: { cliente: true, vehiculo: true, puesto: true },
    orderBy: { id: "desc" },
  });

  const vehiculoIdsFinalizados = [...new Set(ingresos.filter(i => i.fechaSalida).map(i => i.vehiculoId))];
  let ausenciasMap = {};
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
    where: { vehiculoId: ingreso.vehiculoId, estado: "ACTIVA", puestoId: { not: null } },
  });
  if (!planActivo) throw new AppError("El vehículo no tiene plan activo. Registre la salida con cobro desde Ingresos.", 400);

  const fechaSalida = new Date();
  const tiempoMinutos = Math.ceil((fechaSalida - ingreso.fechaEntrada) / (1000 * 60));

  await prisma.$transaction(async (tx) => {
    await tx.ingreso.update({
      where: { id: Number(id) },
      data: { fechaSalida, estado: "FINALIZADO", tiempoMinutos, valorPagado: 0 },
    });
    const otroIngresoActivo = await tx.ingreso.count({ where: { puestoId: ingreso.puestoId, estado: "ACTIVO", id: { not: Number(id) } } });
    await tx.puesto.update({ where: { id: ingreso.puestoId }, data: { estado: otroIngresoActivo > 0 ? "OCUPADO" : "LIBRE" } });
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

  const data: any = {};
  if (vehiculoId !== undefined) {
    const vid = Number(vehiculoId);
    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vid } });
    if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
    if (vehiculo.clienteId !== ingreso.clienteId) throw new AppError("El vehículo no pertenece al cliente de este ingreso", 400);
    if (vehiculo.bloqueado) throw new AppError("El vehículo está bloqueado", 400);
    if (!vehiculo.estado) throw new AppError("El vehículo está inactivo", 400);
    data.vehiculoId = vid;
  }
  const vid = data.vehiculoId ?? ingreso.vehiculoId;

  if (puestoId && Number(puestoId) !== ingreso.puestoId) {
    const nuevoPuesto = await prisma.puesto.findUnique({ where: { id: Number(puestoId) } });
    if (!nuevoPuesto) throw new AppError("Puesto no encontrado", 404);
    if (!nuevoPuesto.activo) throw new AppError("El puesto está inactivo", 400);
    if (nuevoPuesto.estado !== "LIBRE") throw new AppError("El nuevo puesto no está disponible (estado: " + nuevoPuesto.estado + ")", 400);
    data.puestoId = Number(puestoId);
  }

  const actualizado = await prisma.$transaction(async (tx) => {
    if (data.puestoId && data.puestoId !== ingreso.puestoId) {
      await tx.puesto.update({ where: { id: ingreso.puestoId }, data: { estado: "LIBRE" } });
      await tx.puesto.update({ where: { id: data.puestoId }, data: { estado: "OCUPADO" } });
    }
    return tx.ingreso.update({
      where: { id: Number(id) },
      data,
      include: { cliente: true, vehiculo: true, puesto: true },
    });
  });

  await registrarMovimiento("INGRESOS", "EDITAR", `Ingreso #${id} editado`, req.usuario?.usuario || "admin");
  res.json({ ok: true, ingreso: actualizado });
});

export const eliminarIngreso = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ingreso = await prisma.ingreso.findUnique({
    where: { id: Number(id) },
    include: { facturas: { select: { numero: true } } },
  });
  if (!ingreso) throw new AppError("Ingreso no encontrado", 404);
  if (ingreso.estado === "ACTIVO") throw new AppError("No se puede eliminar un ingreso activo. Finalícelo primero.", 400);

  const facturaIds = ingreso.facturas.map(f => f.id);

  await prisma.$transaction(async (tx) => {
    if (ingreso.puestoId) await tx.puesto.update({ where: { id: ingreso.puestoId }, data: { estado: "LIBRE" } });
    await tx.cajaMovimiento.deleteMany({ where: { facturaId: { in: facturaIds } } });
    await tx.factura.deleteMany({ where: { ingresoId: Number(id) } });
    await tx.ingreso.delete({ where: { id: Number(id) } });
  });
  await registrarMovimiento("INGRESOS", "ELIMINAR", `Ingreso #${id} eliminado${facturaIds.length ? ` (${facturaIds.length} factura(s) anulada(s))` : ""}`, req.usuario?.usuario || "admin");
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
    where: { vehiculoId: ingreso.vehiculoId, estado: "ACTIVA", puestoId: { not: null } },
    include: { plan: true },
  });
  if (planActivo) {
    const totalMinutos = Math.ceil((Date.now() - new Date(ingreso.fechaEntrada).getTime()) / 60000);
    return res.json({ ok: true, cobro: { total: 0, totalMinutos, error: null, plan: planActivo.plan?.nombre || "Plan activo" }, ingreso });
  }

  await getCajaOError();

  const cobro = await calcularCobro({
    ingreso,
    tipoVehiculo: ingreso.vehiculo.tipo,
    ticketExtraviado,
  });

  if (cobro.error) throw new AppError(cobro.error, 400);

  res.json({ ok: true, cobro, ingreso });
});

export const registrarSalidaConCobro = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { metodoPago, ticketExtraviado } = req.body;

  const ingreso = await prisma.ingreso.findUnique({
    where: { id: Number(id) },
    include: { cliente: true, vehiculo: true, puesto: true },
  });
  if (!ingreso) throw new AppError("Ingreso no encontrado", 404);
  if (ingreso.estado === "FINALIZADO") throw new AppError("Este ingreso ya fue finalizado", 400);

  const fechaSalida = new Date();
  const mp = metodoPago || "efectivo";

  const ahora = new Date();

  const mensualidadVigente = await prisma.mensualidad.findFirst({
    where: {
      vehiculoId: ingreso.vehiculoId,
      estado: "ACTIVA",
      fechaFin: { gte: ahora },
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
      tipoVehiculo: ingreso.vehiculo.tipo,
      fechaSalida,
      ticketExtraviado,
    });
    if (cobro.error) throw new AppError(cobro.error, 400);
    cobroTotal = cobro.total;
    cobroTotalMinutos = cobro.totalMinutos;
  }

  let valorFinal = cobroTotal;
  let saldoUsado = 0;
  if (!cubiertoPorPlan && ingreso.cliente?.saldo > 0 && valorFinal > 0) {
    saldoUsado = Math.min(ingreso.cliente.saldo, valorFinal);
    valorFinal -= saldoUsado;
  }

  const numeroFactura = cubiertoPorPlan ? null : await generarNumeroFactura("FACT");

  let facturaCreada: any = null;
  const [salida, factura] = await prisma.$transaction(async (tx) => {
    const s = await tx.ingreso.update({
      where: { id: Number(id) },
      data: {
        fechaSalida,
        estado: "FINALIZADO",
        tiempoMinutos: cobroTotalMinutos,
        valorPagado: cubiertoPorPlan ? 0 : cobroTotal,
        ...(ticketExtraviado ? { ticketExtraviado: true } : {}),
      },
      include: { cliente: true, vehiculo: true, puesto: true },
    });

    const otroIngresoActivo = await tx.ingreso.count({ where: { puestoId: ingreso.puestoId, estado: "ACTIVO", id: { not: Number(id) } } });
    const nuevoEstadoPuesto = otroIngresoActivo > 0 ? "OCUPADO" : "LIBRE";
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
    direccion: config?.direccion,
    telefono: config?.telefono,
    correo: config?.correo,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="ticket-${folio}.pdf"`);
  res.send(pdf);
});

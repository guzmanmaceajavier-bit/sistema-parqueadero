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

export const registrarIngreso = asyncHandler(async (req, res) => {
  let { clienteId, vehiculoId, puestoId } = req.body;
  clienteId = Number(clienteId);
  vehiculoId = Number(vehiculoId);

  // Check bloqueado
  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId }, include: { cliente: true } });
  if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
  if (vehiculo.bloqueado) throw new AppError("El vehículo está bloqueado y no puede ingresar", 400);
  if (vehiculo.cliente?.bloqueado) throw new AppError("El cliente está bloqueado y no puede ingresar", 400);

  let reservaVinculada = null;
  if (!puestoId) {
    reservaVinculada = await service.buscarReservaActiva(clienteId);
    if (reservaVinculada) {
      puestoId = reservaVinculada.puestoId;
      await service.activarReserva(reservaVinculada.id);
    }
  }

  if (!puestoId) throw new AppError("Debes seleccionar un puesto o tener una reserva activa", 400);

  const puesto = await prisma.puesto.findUnique({ where: { id: Number(puestoId) } });
  if (!puesto) throw new AppError("Puesto no encontrado", 404);
  if (puesto.estado === "OCUPADO") throw new AppError("El puesto ya está ocupado", 400);
  if (puesto.estado === "MANTENIMIENTO") throw new AppError("El puesto está en mantenimiento", 400);

  const placa = req.body.placa || vehiculo.placa;
  const existenteActivo = await prisma.ingreso.findFirst({
    where: { vehiculo: { placa }, estado: "ACTIVO" },
    include: { vehiculo: true },
  });
  if (existenteActivo) throw new AppError(`El vehículo con placa ${placa} ya se encuentra dentro del parqueadero`, 400);

  const ingreso = await prisma.$transaction(async (tx) => {
    await tx.puesto.update({ where: { id: Number(puestoId) }, data: { estado: "OCUPADO" } });
    const data = { clienteId, vehiculoId, puestoId: Number(puestoId) };
    if (reservaVinculada) data.reservaId = reservaVinculada.id;
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

export const registrarSalida = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ingreso = await prisma.ingreso.findUnique({
    where: { id: Number(id) },
    include: { cliente: true, vehiculo: true, puesto: true },
  });
  if (!ingreso) throw new AppError("Ingreso no encontrado", 404);
  if (ingreso.estado === "FINALIZADO") throw new AppError("Este ingreso ya fue finalizado", 400);

  const fechaSalida = new Date();
  const tiempoMinutos = Math.ceil((fechaSalida - ingreso.fechaEntrada) / (1000 * 60));

  const tarifa = await prisma.tarifa.findFirst({
    where: {
      OR: [
        { tipoVehiculo: { contains: ingreso.vehiculo.tipo } },
        { tipoVehiculo: "todos" },
      ],
      modalidad: "hora",
      activa: true,
    },
  });

  let valorPagado = 0;
  let horas = 0;
  if (tarifa) {
    const cortesia = tarifa.minutosCortesia || 0;
    let minutosFacturables = Math.max(0, tiempoMinutos - cortesia);
    horas = Math.ceil(minutosFacturables / 60);
    valorPagado = horas * tarifa.valor;
  }

  const metodoPago = req.body.metodoPago || "efectivo";

  const numeroFactura = await generarNumeroFactura("FACT");

  const [salida, factura] = await prisma.$transaction(async (tx) => {
    const s = await tx.ingreso.update({
      where: { id: Number(id) },
      data: { fechaSalida, estado: "FINALIZADO", tiempoMinutos, valorPagado },
      include: { cliente: true, vehiculo: true, puesto: true },
    });
    await tx.puesto.update({ where: { id: ingreso.puestoId }, data: { estado: "LIBRE" } });
    if (ingreso.reservaId) {
      await tx.reserva.update({ where: { id: ingreso.reservaId }, data: { estado: "FINALIZADA" } });
    }
    const f = await tx.factura.create({
      data: { numero: numeroFactura, ingresoId: ingreso.id, origen: "INGRESO", valor: valorPagado, metodoPago },
    });
    const cajaAbierta = await tx.caja.findFirst({ where: { estado: "ABIERTA" } });
    if (!cajaAbierta) throw new AppError("No hay caja abierta", 400);
    await tx.cajaMovimiento.create({
      data: { cajaId: cajaAbierta.id, tipo: "INGRESO", concepto: `Factura ${numeroFactura} — Salida ${ingreso.vehiculo.placa}`, monto: valorPagado, metodoPago, facturaId: f.id },
    });
    return [s, f];
  });

  const cajaResp = await getCajaAbierta();

  await registrarMovimiento("FACTURACION", "CREAR", `Factura ${numeroFactura} generada por $${valorPagado}`, req.usuario?.usuario || "admin");
  emitirEvento("ingreso:salida", { mensaje: `Vehículo ${ingreso.vehiculo.placa} salió — Factura ${numeroFactura} por $${valorPagado}`, factura, ingreso: salida, valor: valorPagado });

  res.json({ ok: true, message: "Salida registrada", tiempoMinutos, horas, valorPagado, factura, salida, caja: cajaResp });
});

export const liberarPuesto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ingreso = await prisma.ingreso.findUnique({ where: { id: Number(id) } });
  if (!ingreso) throw new AppError("Ingreso no encontrado", 404);
  if (ingreso.estado === "FINALIZADO") throw new AppError("Este ingreso ya fue finalizado", 400);

  const fechaSalida = new Date();
  const tiempoMinutos = Math.ceil((fechaSalida - ingreso.fechaEntrada) / (1000 * 60));

  let tienePlan = false;
  await prisma.$transaction(async (tx) => {
    await tx.ingreso.update({
      where: { id: Number(id) },
      data: { fechaSalida, estado: "FINALIZADO", tiempoMinutos, valorPagado: 0 },
    });
    const planActivo = await tx.mensualidad.findFirst({
      where: { vehiculoId: ingreso.vehiculoId, estado: "ACTIVA", puestoId: { not: null } },
    });
    tienePlan = !!planActivo;
    await tx.puesto.update({ where: { id: ingreso.puestoId }, data: { estado: tienePlan ? "OCUPADO" : "LIBRE" } });
  });
  await registrarMovimiento("INGRESOS", "LIBERAR", `Ingreso #${id} finalizado — puesto ${tienePlan ? "sigue OCUPADO (plan activo)" : "LIBRE"}`, req.usuario?.usuario || "admin");

  res.json({ ok: true, message: tienePlan ? "Ingreso finalizado — plan activo, puesto no se libera" : "Puesto liberado" });
});

export const actualizarIngreso = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { vehiculoId, puestoId } = req.body;

  const ingreso = await prisma.ingreso.findUnique({ where: { id: Number(id) } });
  if (!ingreso) throw new AppError("Ingreso no encontrado", 404);
  if (ingreso.estado !== "ACTIVO") throw new AppError("Solo se puede editar un ingreso activo", 400);

  const data = {};
  if (vehiculoId) data.vehiculoId = Number(vehiculoId);
  if (puestoId && Number(puestoId) !== ingreso.puestoId) {
    const nuevoPuesto = await prisma.puesto.findUnique({ where: { id: Number(puestoId) } });
    if (!nuevoPuesto) throw new AppError("Puesto no encontrado", 404);
    if (nuevoPuesto.estado === "OCUPADO") throw new AppError("El nuevo puesto ya está ocupado", 400);
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
  const { metodoPago, modalidad, ticketExtraviado } = req.body;

  const ingreso = await prisma.ingreso.findUnique({
    where: { id: Number(id) },
    include: { cliente: true, vehiculo: true, puesto: true },
  });
  if (!ingreso) throw new AppError("Ingreso no encontrado", 404);
  if (ingreso.estado === "FINALIZADO") throw new AppError("Este ingreso ya fue finalizado", 400);

  const fechaSalida = new Date();

  const planActivo = await prisma.mensualidad.findFirst({
    where: { vehiculoId: ingreso.vehiculoId, estado: "ACTIVA", puestoId: { not: null } },
  });

  if (planActivo) {
    const totalMinutos = Math.ceil((fechaSalida.getTime() - new Date(ingreso.fechaEntrada).getTime()) / 60000);
    const salida = await prisma.$transaction(async (tx) => {
      const s = await tx.ingreso.update({
        where: { id: Number(id) },
        data: { fechaSalida, estado: "FINALIZADO", tiempoMinutos: totalMinutos, valorPagado: 0 },
        include: { cliente: true, vehiculo: true, puesto: true },
      });
      await tx.puesto.update({ where: { id: ingreso.puestoId }, data: { estado: "OCUPADO" } });
      return s;
    });
    await registrarMovimiento("INGRESOS", "SALIDA", `Salida ${ingreso.vehiculo.placa} — plan activo, sin cobro`, req.usuario?.usuario || "admin");
    return res.json({ ok: true, message: "Salida registrada — el cliente tiene plan activo, no se generó cobro", salida, cobro: { total: 0, totalMinutos } });
  }

  const cobro = await calcularCobro({
    ingreso,
    tipoVehiculo: ingreso.vehiculo.tipo,
    modalidad,
    fechaSalida,
    ticketExtraviado,
  });

  if (cobro.error) throw new AppError(cobro.error, 400);

  const mp = metodoPago || "efectivo";
  let valorFinal = cobro.total;
  let saldoUsado = 0;
  if (ingreso.cliente?.saldo > 0 && valorFinal > 0) {
    saldoUsado = Math.min(ingreso.cliente.saldo, valorFinal);
    valorFinal -= saldoUsado;
  }

  const numeroFactura = await generarNumeroFactura("FACT");

  const [salida, factura] = await prisma.$transaction(async (tx) => {
    const updateData: any = {
      fechaSalida,
      estado: "FINALIZADO",
      tiempoMinutos: cobro.totalMinutos,
      valorPagado: cobro.total,
    };
    if (ticketExtraviado) updateData.ticketExtraviado = true;
    const s = await tx.ingreso.update({
      where: { id: Number(id) },
      data: updateData,
      include: { cliente: true, vehiculo: true, puesto: true },
    });
    await tx.puesto.update({
      where: { id: ingreso.puestoId },
      data: { estado: "LIBRE" },
    });
    if (ingreso.reservaId) {
      await tx.reserva.update({ where: { id: ingreso.reservaId }, data: { estado: "FINALIZADA" } });
    }
    if (saldoUsado > 0 && ingreso.clienteId) {
      await tx.cliente.update({ where: { id: ingreso.clienteId }, data: { saldo: { decrement: saldoUsado } } });
    }
    const f = await tx.factura.create({
      data: { numero: numeroFactura, ingresoId: ingreso.id, origen: "INGRESO", valor: valorFinal, metodoPago: mp },
    });
    const cajaAbierta = await tx.caja.findFirst({ where: { estado: "ABIERTA" } });
    if (!cajaAbierta) throw new AppError("No hay caja abierta", 400);
    const conceptoExtra = ticketExtraviado ? " [TICKET EXTRAVIADO]" : "";
    await tx.cajaMovimiento.create({
      data: { cajaId: cajaAbierta.id, tipo: "INGRESO", concepto: `Factura ${numeroFactura} — Salida ${ingreso.vehiculo.placa}${conceptoExtra}`, monto: valorFinal, metodoPago: mp, facturaId: f.id },
    });
    return [s, f];
  });

  const cajaResp = await getCajaAbierta();
  await registrarMovimiento("FACTURACION", "CREAR", `Factura ${numeroFactura} por $${valorFinal}${ticketExtraviado ? " (ticket extraviado)" : ""}${saldoUsado > 0 ? ` (saldo usado: $${saldoUsado})` : ""}`, req.usuario?.usuario || "admin");

  emitirEvento("ingreso:salida", {
    mensaje: `Vehículo ${ingreso.vehiculo.placa} salió — Factura ${numeroFactura} por $${valorFinal}${ticketExtraviado ? " (ticket extraviado)" : ""}`,
    factura, ingreso: salida, valor: valorFinal,
  });

  res.json({ ok: true, message: "Salida registrada", cobro: { ...cobro, total: valorFinal, saldoUsado }, factura, salida, caja: cajaResp });
});

export const ticketEntrada = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const factura = await prisma.factura.findUnique({
    where: { id: Number(id) },
    include: { ingreso: { include: { vehiculo: { include: { cliente: true } }, puesto: true } } },
  });
  if (!factura || !factura.ingreso) throw new AppError('Ingreso no encontrado', 404);

  const ing = factura.ingreso;
  const config = await prisma.configuracion.findFirst();
  const pdf = await generarTicketPDF({
    titulo: 'TICKET DE ENTRADA',
    tipo: 'entrada',
    folio: factura.numero,
    placa: ing.vehiculo?.placa || '\u2014',
    cliente: [ing.vehiculo?.cliente?.nombres, ing.vehiculo?.cliente?.apellidos].filter(Boolean).join(' ') || '',
    vehiculo: `${ing.vehiculo?.marca || ''} ${ing.vehiculo?.modelo || ''}`.trim() || ing.vehiculo?.tipo || '',
    ingreso: ing.fechaEntrada ? new Date(ing.fechaEntrada).toLocaleString('es-CO') : '',
    puesto: ing.puesto?.codigo || '',
    parqueadero: config?.nombreParqueadero || 'Parqueadero',
    direccion: config?.direccion,
    telefono: config?.telefono,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="ticket-entrada-${factura.numero}.pdf"`);
  res.send(pdf);
});

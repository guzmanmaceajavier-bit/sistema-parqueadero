import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { generarNumeroFactura } from "../../services/facturaCounter.js";
import { resolverSucursalPermitida } from "../../utils/sucursalAccess.js";
import { calcularCobro } from "../../services/calculadorCobros.js";
import { calcularPagadoMensualidad } from "../../utils/saldos.js";
import { redondearDinero, restarDinero } from "../../utils/dinero.js";

export const crearAusencia = asyncHandler(async (req, res) => {
  const { clienteId, vehiculoId, fechaSalida, fechaRegreso, motivo, opcion } = req.body;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.body.sucursalId);
  if (!clienteId || !vehiculoId) throw new AppError("Cliente y vehículo son requeridos", 400);

  const cid = Number(clienteId);
  const vid = Number(vehiculoId);

  const [cliente, vehiculo] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: cid } }),
    prisma.vehiculo.findUnique({ where: { id: vid } }),
  ]);
  if (!cliente) throw new AppError("Cliente no encontrado", 404);
  if (!vehiculo) throw new AppError("Vehículo no encontrado", 404);
  if (sucursalId && vehiculo.sucursalId !== sucursalId) throw new AppError("El vehículo pertenece a otra sucursal", 403);
  if (vehiculo.clienteId !== cid) throw new AppError("El vehículo no pertenece al cliente seleccionado", 400);

  const ausencia = await prisma.$transaction(async (tx) => {
    // Serializa la ausencia con entradas y salidas para que el mismo vehículo
    // no pueda cerrar dos veces su ingreso ni liberar el puesto por duplicado.
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${vid}::integer)) AS advisory_lock`;
    const ausenciaPreviaActiva = await tx.ausencia.findFirst({ where: { vehiculoId: vid, estado: "ACTIVA" }, select: { id: true } });
    if (ausenciaPreviaActiva) throw new AppError("El vehículo ya tiene una ausencia activa. Finalízala antes de registrar otra.", 409);
    const ingresoActivo = await tx.ingreso.findFirst({
      where: { vehiculoId: vid, estado: "ACTIVO" },
      include: { puesto: true, vehiculo: true },
    });
    if (ingresoActivo?.puestoId) {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${ingresoActivo.puestoId}::integer)) AS advisory_lock`;
    }
    const ahora = new Date();
    const sucursalIngreso = ingresoActivo?.vehiculo.sucursalId ?? vehiculo.sucursalId ?? sucursalId ?? null;
    const planActivo = await tx.mensualidad.findFirst({
      where: {
        vehiculoId: vid, sucursalId: sucursalIngreso, estado: "ACTIVA",
        fechaInicio: { lte: ahora }, fechaFin: { gte: ahora },
        ...(ingresoActivo?.puestoId ? { OR: [{ puestoId: null }, { puestoId: ingresoActivo.puestoId }] } : {}),
      },
      include: { facturas: { select: { createdAt: true, valor: true, metodoPago: true, anulada: true } } },
      orderBy: { fechaInicio: "desc" },
    });
    const fechaSalidaEfectiva = fechaSalida ? new Date(fechaSalida) : ahora;
    if (!Number.isFinite(fechaSalidaEfectiva.getTime()) || fechaSalidaEfectiva > ahora) throw new AppError("La fecha de salida no es válida o está en el futuro", 400);
    if (fechaRegreso) {
      const regresoInicial = new Date(fechaRegreso);
      if (!Number.isFinite(regresoInicial.getTime()) || regresoInicial < fechaSalidaEfectiva || regresoInicial > ahora) throw new AppError("La fecha de regreso inicial no es válida", 400);
    }
    if (ingresoActivo && fechaSalidaEfectiva < ingresoActivo.fechaEntrada) throw new AppError("La salida no puede ser anterior al ingreso del vehículo", 400);

    const a = await tx.ausencia.create({
      data: {
        clienteId: cid, vehiculoId: vid, sucursalId: sucursalIngreso,
        puestoId: ingresoActivo?.puestoId ?? planActivo?.puestoId ?? null,
        mensualidadId: planActivo?.id ?? null,
        fechaSalida: fechaSalidaEfectiva, fechaRegreso: fechaRegreso ? new Date(fechaRegreso) : null,
        motivo, opcion: opcion || "CONGELAR",
      },
      include: { cliente: true, vehiculo: true },
    });

    if (ingresoActivo) {
      const tiempoMinutos = Math.max(0, Math.ceil((fechaSalidaEfectiva.getTime() - ingresoActivo.fechaEntrada.getTime()) / (1000 * 60)));
      // La mensualidad vigente cubre el uso del puesto aunque tenga saldo pendiente.
      // El saldo sigue pendiente en la cuenta del cliente; no se genera un segundo cobro diario.
      const cubiertoPorPlan = !!planActivo;

      let valorFacturado = 0;
      if (!cubiertoPorPlan) {
        // No duplicar una fórmula simplificada: reutilizar el calculador central
        // para respetar modalidad, cortesías, minutos gratis, progresivas y topes.
        const cobro = await calcularCobro({
          ingreso: ingresoActivo,
          tipoVehiculo: ingresoActivo.vehiculo.tipo || undefined,
          fechaSalida: fechaSalidaEfectiva,
          tarifaId: ingresoActivo.vehiculo.tarifaId ?? undefined,
        });
        if (cobro.error) throw new AppError(cobro.error, 400);
        valorFacturado = cobro.total;

        await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124019)) AS advisory_lock`;
        const cajaAbierta = await tx.caja.findFirst({ where: { estado: "ABIERTA", sucursalId: sucursalIngreso } });
        if (!cajaAbierta) throw new AppError("No hay caja abierta para registrar la salida por ausencia", 400);

        const numeroFactura = await generarNumeroFactura("FACT");
        const factura = await tx.factura.create({
          data: {
            numero: numeroFactura,
            ingresoId: ingresoActivo.id,
            origen: "INGRESO",
            valor: valorFacturado,
            metodoPago: "efectivo",
            sucursalId: sucursalIngreso,
            tarifaId: cobro.tarifa?.id,
            modalidad: cobro.tarifa?.modalidad,
            tiempoMinutos: cobro.totalMinutos,
            desglose: { ...cobro.desglose, detalle: cobro.detalle, salidaPorAusencia: true },
          },
        });
        await tx.cajaMovimiento.create({
          data: {
            cajaId: cajaAbierta.id,
            tipo: "INGRESO",
            concepto: `Factura ${numeroFactura} — Salida por ausencia ${ingresoActivo.vehiculo.placa}`,
            monto: valorFacturado,
            metodoPago: "efectivo",
            facturaId: factura.id,
          },
        });
      }

      await tx.ingreso.update({
        where: { id: ingresoActivo.id },
        data: { fechaSalida: fechaSalidaEfectiva, estado: "FINALIZADO", tiempoMinutos, valorPagado: valorFacturado },
      });
      if (ingresoActivo.puestoId) {
        await tx.puesto.update({ where: { id: ingresoActivo.puestoId }, data: { estado: "AUSENCIA" } });
      }
    } else if (a.puestoId) {
      // Si se registra la ausencia cuando el vehículo ya está fuera, igualmente
      // se conserva el puesto contractual para su regreso.
      await tx.puesto.updateMany({ where: { id: a.puestoId, estado: "LIBRE" }, data: { estado: "RESERVADO" } });
    }

    return a;
  });

  await registrarMovimiento("AUSENCIAS", "CREAR", `Ausencia: ${cliente.nombres} ${cliente.apellidos}`, req.usuario?.usuario || "admin");
  res.status(201).json({ ok: true, ausencia });
});

export const obtenerAusencias = asyncHandler(async (req, res) => {
  const { page, limit, estado, clienteId, q } = req.query;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const where: any = sucursalId ? { sucursalId } : {};
  if (estado) where.estado = estado;
  if (clienteId) where.clienteId = Number(clienteId);
  if (q) {
    where.OR = [
      { cliente: { nombres: { contains: q, mode: "insensitive" } } },
      { cliente: { apellidos: { contains: q, mode: "insensitive" } } },
      { vehiculo: { placa: { contains: q, mode: "insensitive" } } },
      { motivo: { contains: q, mode: "insensitive" } },
    ];
  }

  const { data: ausencias, pagination } = await paginate(prisma, "ausencia", {
    page, limit, where,
    include: { cliente: true, vehiculo: true },
    orderBy: { fechaSalida: "desc" },
  });
  res.json({ ok: true, ausencias, pagination });
});

export const obtenerAusencia = asyncHandler(async (req, res) => {
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const { id } = req.params;
  const ausencia = await prisma.ausencia.findFirst({
    where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) },
    include: { cliente: true, vehiculo: true },
  });
  if (!ausencia) throw new AppError("Ausencia no encontrada", 404);
  res.json({ ok: true, ausencia });
});

export const actualizarAusencia = asyncHandler(async (req, res) => {
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const { id } = req.params;
  const { fechaSalida, fechaRegreso, motivo, opcion, estado } = req.body;

  const existente = await prisma.ausencia.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) } });
  if (!existente) throw new AppError("Ausencia no encontrada", 404);

  // Cambiar el estado por esta ruta omitía la lógica de finalización
  // (devolución del puesto, fechas y ajustes de mensualidad).
  if (estado !== undefined) {
    throw new AppError("El estado debe modificarse mediante la acción de finalizar ausencia", 400);
  }

  const data: any = {};
  if (fechaSalida !== undefined) {
    const fecha = new Date(fechaSalida);
    if (!Number.isFinite(fecha.getTime())) throw new AppError("La fecha de salida no es válida", 400);
    data.fechaSalida = fecha;
  }
  if (fechaRegreso !== undefined) {
    if (fechaRegreso === null || fechaRegreso === "") data.fechaRegreso = null;
    else {
      const fecha = new Date(fechaRegreso);
      if (!Number.isFinite(fecha.getTime())) throw new AppError("La fecha de regreso no es válida", 400);
      if (data.fechaSalida && fecha < data.fechaSalida) throw new AppError("La fecha de regreso no puede ser anterior a la salida", 400);
      data.fechaRegreso = fecha;
    }
  }
  if (motivo !== undefined) data.motivo = motivo;
  if (opcion !== undefined) {
    const opcionesValidas = ["HISTORIAL", "CONGELAR", "EXTENDER", "DESCONTAR", "MANTENER"];
    if (!opcionesValidas.includes(opcion)) throw new AppError("La opción de ausencia no es válida", 400);
    data.opcion = opcion;
  }

  const ausencia = await prisma.ausencia.update({
    where: { id: Number(id) }, data,
    include: { cliente: true, vehiculo: true },
  });
  res.json({ ok: true, ausencia });
});

export const finalizarAusencia = asyncHandler(async (req, res) => {
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const { id } = req.params;
  const diasCompensacionSolicitados = req.body?.diasCompensacion === undefined ? null : Number(req.body.diasCompensacion);
  if (diasCompensacionSolicitados !== null && (!Number.isInteger(diasCompensacionSolicitados) || diasCompensacionSolicitados < 0 || diasCompensacionSolicitados > 365)) {
    throw new AppError("Los días de compensación deben ser un entero entre 0 y 365", 400);
  }
  const existente = await prisma.ausencia.findFirst({
    where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) },
    include: { cliente: true, vehiculo: true },
  });
  if (!existente) throw new AppError("Ausencia no encontrada", 404);
  if (existente.estado === "FINALIZADA") throw new AppError("La ausencia ya está finalizada", 400);

  let mensaje = "Ausencia finalizada";

  const ausencia = await prisma.$transaction(async (tx) => {
    // La finalización puede liberar el puesto y extender planes; comparte
    // los bloqueos operativos con ingresos, reservas y mensualidades.
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${existente.vehiculoId}::integer)) AS advisory_lock`;
    const ingresoParaBloqueo = await tx.ingreso.findFirst({
      where: { vehiculoId: existente.vehiculoId, estado: "FINALIZADO", fechaSalida: { gte: existente.fechaSalida } },
      orderBy: { fechaSalida: "desc" },
      select: { puestoId: true },
    });
    const puestoParaBloqueo = existente.puestoId ?? ingresoParaBloqueo?.puestoId;
    if (puestoParaBloqueo) {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${puestoParaBloqueo}::integer)) AS advisory_lock`;
    }
    const ausenciaActual = await tx.ausencia.findFirst({ where: { id: Number(id) } });
    if (!ausenciaActual || ausenciaActual.estado !== "ACTIVA") {
      throw new AppError("La ausencia ya fue finalizada por otra operación", 409);
    }
    const fechaRegreso = new Date();
    const diasAusente = Math.max(1, Math.ceil((fechaRegreso.getTime() - existente.fechaSalida.getTime()) / 86400000));

    const a = await tx.ausencia.update({
      where: { id: Number(id) },
      data: { estado: "FINALIZADA", fechaRegreso },
      include: { cliente: true, vehiculo: true },
    });

    const otrasAusenciasActivas = await tx.ausencia.count({
      where: { clienteId: a.clienteId, ...(sucursalId ? { sucursalId } : {}), estado: "ACTIVA", id: { not: Number(id) } },
    });
    if (otrasAusenciasActivas === 0) {
      await tx.cliente.update({ where: { id: a.clienteId }, data: { estado: "ACTIVO" } });
    }

    const ingresoAusencia = a.puestoId ? null : await tx.ingreso.findFirst({
      where: { vehiculoId: a.vehiculoId, ...(sucursalId ? { vehiculo: { sucursalId } } : {}), estado: "FINALIZADO", fechaSalida: { gte: existente.createdAt } },
      orderBy: { fechaSalida: "asc" },
    });
    const puestoAusenciaId = a.puestoId ?? ingresoAusencia?.puestoId ?? null;
    // Solo se compensa la mensualidad que cubría el puesto/vehículo al salir.
    // Nunca se alteran todas las mensualidades históricas del mismo vehículo.
    const mensualidadAusencia = await tx.mensualidad.findFirst({
      where: {
        vehiculoId: a.vehiculoId,
        ...(sucursalId ? { sucursalId } : {}),
        estado: a.mensualidadId ? { in: ["ACTIVA", "VENCIDA"] } : "ACTIVA",
        fechaInicio: { lte: existente.fechaSalida },
        fechaFin: { gte: existente.fechaSalida },
        ...(a.mensualidadId ? { id: a.mensualidadId } : { ...(puestoAusenciaId ? { OR: [{ puestoId: null }, { puestoId: puestoAusenciaId }] } : {}) }),
      },
      include: { facturas: { select: { createdAt: true, valor: true, metodoPago: true, anulada: true } } },
      orderBy: { fechaInicio: "desc" },
    });

    let diasCompensados = 0;
    let valorCompensado = 0;
    if (mensualidadAusencia && (existente.opcion === "CONGELAR" || existente.opcion === "EXTENDER")) {
      const diasAplicados = existente.opcion === "EXTENDER" && diasCompensacionSolicitados !== null
        ? diasCompensacionSolicitados
        : diasAusente;
      if (diasAplicados > 0) {
        const nuevaFechaFin = new Date(mensualidadAusencia.fechaFin.getTime() + diasAplicados * 86400000);
        diasCompensados = diasAplicados;
        const detalle = `Ausencia #${id}: ${existente.opcion.toLowerCase()} de ${diasAplicados} día(s), ${fechaRegreso.toISOString()}`;
        await tx.mensualidad.update({
          where: { id: mensualidadAusencia.id },
          data: {
            fechaFin: nuevaFechaFin,
            estado: "ACTIVA",
            observacion: [mensualidadAusencia.observacion, detalle].filter(Boolean).join("\n").slice(0, 2000),
          },
        });
        mensaje = `${existente.opcion === "CONGELAR" ? "Mensualidad congelada" : "Vencimiento extendido"} ${diasAplicados} día(s) — nueva fecha fin: ${nuevaFechaFin.toLocaleDateString("es-CO")}`;
      } else {
        mensaje = "Ausencia finalizada sin días adicionales de compensación";
      }
    } else if (mensualidadAusencia && existente.opcion === "DESCONTAR") {
      // El descuento primero reduce la deuda pendiente. Si ya estaba pagada,
      // o sobra compensación después de cubrir la deuda, el excedente va al saldo
      // a favor del cliente con un movimiento trazable (no se altera la factura).
      const pagado = calcularPagadoMensualidad(mensualidadAusencia.facturas, mensualidadAusencia.fechaInicio);
      const descuentoSolicitado = redondearDinero((mensualidadAusencia.valor / 30) * diasAusente);
      diasCompensados = diasAusente;
      valorCompensado = descuentoSolicitado;
      const deudaPendiente = Math.max(0, restarDinero(mensualidadAusencia.valor, pagado));
      const reduccionDeuda = Math.min(descuentoSolicitado, deudaPendiente);
      const creditoCliente = Math.max(0, restarDinero(descuentoSolicitado, reduccionDeuda));
      if (reduccionDeuda > 0) {
        await tx.mensualidad.update({
          where: { id: mensualidadAusencia.id },
          data: {
            valor: Math.max(pagado, restarDinero(mensualidadAusencia.valor, reduccionDeuda)),
            observacion: [mensualidadAusencia.observacion, `Ausencia #${id}: descuento de deuda por $${reduccionDeuda.toLocaleString("es-CO")}`].filter(Boolean).join("\n").slice(0, 2000),
          },
        });
      }
      if (creditoCliente > 0) {
        await tx.$queryRaw`SELECT "id" FROM "Cliente" WHERE "id" = ${a.clienteId} FOR UPDATE`;
        const clienteActual = await tx.cliente.findUnique({ where: { id: a.clienteId }, select: { saldo: true } });
        const saldoAntes = redondearDinero(clienteActual?.saldo ?? 0);
        const saldoDespues = redondearDinero(saldoAntes + creditoCliente);
        await tx.cliente.update({ where: { id: a.clienteId }, data: { saldo: saldoDespues } });
        await tx.clienteSaldoMovimiento.create({
          data: {
            clienteId: a.clienteId, tipo: "DEVOLUCION", monto: creditoCliente,
            saldoAntes, saldoDespues,
            concepto: `Compensación por ausencia #${id} — vehículo ${a.vehiculo?.placa || a.vehiculoId}`,
            usuario: req.usuario?.usuario || "admin",
          },
        });
      }
      mensaje = `Compensación aplicada: $${descuentoSolicitado.toLocaleString("es-CO")} por ${diasAusente} día(s). Deuda reducida: $${reduccionDeuda.toLocaleString("es-CO")}; saldo a favor: $${creditoCliente.toLocaleString("es-CO")}.`;
    } else if (existente.opcion === "MANTENER") {
      mensaje = "Ausencia finalizada — mensualidad sin cambios";
    } else if (existente.opcion === "HISTORIAL") {
      mensaje = "Ausencia registrada únicamente en el historial; no se modificó la mensualidad";
    } else if (!mensualidadAusencia) {
      mensaje = "Ausencia finalizada; no se encontró una mensualidad que cubriera la fecha de salida para compensar";
    }

    // Se actualiza el estado del puesto después de aplicar la compensación, para
    // que una mensualidad extendida conserve la reserva aunque su fecha original
    // haya vencido durante la ausencia.
    if (puestoAusenciaId) {
      const ahora = new Date();
      const [ingresoActivoPuesto, mensualidadActivaPuesto, reservaActivaPuesto] = await Promise.all([
        tx.ingreso.count({ where: { puestoId: puestoAusenciaId, estado: "ACTIVO" } }),
        tx.mensualidad.count({
          where: {
            estado: "ACTIVA", fechaFin: { gte: ahora },
            OR: [
              { puestoId: puestoAusenciaId },
              ...(a.mensualidadId ? [{ id: a.mensualidadId, puestoId: null }] : []),
            ],
          },
        }),
        tx.reserva.count({ where: { puestoId: puestoAusenciaId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] } }),
      ]);
      const nuevoEstado = ingresoActivoPuesto > 0 ? "OCUPADO" : mensualidadActivaPuesto > 0 || reservaActivaPuesto > 0 ? "RESERVADO" : "LIBRE";
      await tx.puesto.update({ where: { id: puestoAusenciaId }, data: { estado: nuevoEstado } });
    }

    return tx.ausencia.update({
      where: { id: Number(id) },
      data: { diasCompensados, valorCompensado, compensacionDetalle: mensaje, compensacionAplicadaAt: new Date() },
      include: { cliente: true, vehiculo: true },
    });
  });

  await registrarMovimiento("AUSENCIAS", "FINALIZAR", `Ausencia #${id} finalizada — ${existente.cliente?.nombres} (${existente.opcion})`, req.usuario?.usuario || "admin");
  res.json({ ok: true, ausencia, mensaje });
});

export const eliminarAusencia = asyncHandler(async (req, res) => {
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const { id } = req.params;
  const existente = await prisma.ausencia.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) } });
  if (!existente) throw new AppError("Ausencia no encontrada", 404);

  await prisma.ausencia.delete({ where: { id: Number(id) } });
  await registrarMovimiento("AUSENCIAS", "ELIMINAR", `Ausencia eliminada`, req.usuario?.usuario || "admin");
  res.json({ ok: true, message: "Ausencia eliminada" });
});

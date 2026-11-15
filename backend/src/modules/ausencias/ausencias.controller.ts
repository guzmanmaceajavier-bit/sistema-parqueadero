import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { generarNumeroFactura } from "../../services/facturaCounter.js";
import { resolverSucursalPermitida } from "../../utils/sucursalAccess.js";
import { calcularCobro } from "../../services/calculadorCobros.js";
import { calcularPagadoMensualidad } from "../../utils/saldos.js";
import { redondearDinero, restarDinero, sumarDinero } from "../../utils/dinero.js";
import { emitirEvento } from "../../services/socket.js";

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
    const fechaSalidaEfectiva = fechaSalida ? new Date(fechaSalida) : ahora;
    if (!Number.isFinite(fechaSalidaEfectiva.getTime()) || fechaSalidaEfectiva > ahora) throw new AppError("La fecha de salida no es válida o está en el futuro", 400);
    if (fechaRegreso) {
      const regresoInicial = new Date(fechaRegreso);
      if (!Number.isFinite(regresoInicial.getTime()) || regresoInicial < fechaSalidaEfectiva || regresoInicial > ahora) throw new AppError("La fecha de regreso inicial no es válida", 400);
    }
    if (ingresoActivo && fechaSalidaEfectiva < ingresoActivo.fechaEntrada) throw new AppError("La salida no puede ser anterior al ingreso del vehículo", 400);
    const planActivo = await tx.mensualidad.findFirst({
      where: {
        vehiculoId: vid, sucursalId: sucursalIngreso, estado: "ACTIVA",
        fechaInicio: { lte: ahora }, fechaFin: { gte: ahora },
        ...(ingresoActivo?.puestoId ? { OR: [{ puestoId: null }, { puestoId: ingresoActivo.puestoId }] } : {}),
      },
      include: { facturas: { select: { createdAt: true, valor: true, metodoPago: true, anulada: true } } },
      orderBy: { fechaInicio: "desc" },
    });
    if (planActivo?.puestoId && ingresoActivo?.puestoId && planActivo.puestoId !== ingresoActivo.puestoId) {
      throw new AppError("El puesto del ingreso no coincide con el puesto asignado por la mensualidad. Corrige la asignación antes de registrar la ausencia.", 409);
    }
    const planQueCubriaEntrada = ingresoActivo && !planActivo ? await tx.mensualidad.findFirst({
      where: {
        vehiculoId: vid, sucursalId: sucursalIngreso, estado: { in: ["ACTIVA", "VENCIDA"] },
        fechaInicio: { lte: ingresoActivo.fechaEntrada },
        fechaFin: { gte: ingresoActivo.fechaEntrada, lt: fechaSalidaEfectiva },
        ...(ingresoActivo.puestoId ? { OR: [{ puestoId: null }, { puestoId: ingresoActivo.puestoId }] } : {}),
      },
      orderBy: { fechaFin: "desc" },
    }) : null;

    const a = await tx.ausencia.create({
      data: {
        clienteId: cid, vehiculoId: vid, sucursalId: sucursalIngreso,
        puestoId: ingresoActivo?.puestoId ?? planActivo?.puestoId ?? null,
        mensualidadId: planActivo?.id ?? null,
        fechaSalida: fechaSalidaEfectiva, fechaRegreso: fechaRegreso ? new Date(fechaRegreso) : null,
        motivo, opcion: opcion || "CONGELAR",
      },
      include: { cliente: true, vehiculo: true, puesto: true, mensualidad: { select: { id: true, fechaInicio: true, fechaFin: true, valor: true, estado: true } } },
    });

    if (ingresoActivo) {
      let tiempoMinutos = Math.max(0, Math.ceil((fechaSalidaEfectiva.getTime() - ingresoActivo.fechaEntrada.getTime()) / (1000 * 60)));
      // La mensualidad vigente cubre el uso del puesto aunque tenga saldo pendiente.
      // El saldo sigue pendiente en la cuenta del cliente; no se genera un segundo cobro diario.
      const cubiertoPorPlan = !!planActivo;

      let valorFacturado = 0;
      if (!cubiertoPorPlan) {
        // No duplicar una fórmula simplificada: reutilizar el calculador central
        // para respetar modalidad, cortesías, minutos gratis, progresivas y topes.
        const ingresoFacturable = planQueCubriaEntrada
          ? { ...ingresoActivo, fechaEntrada: planQueCubriaEntrada.fechaFin }
          : ingresoActivo;
        const cobro = await calcularCobro({
          ingreso: ingresoFacturable,
          tipoVehiculo: ingresoActivo.vehiculo.tipo || undefined,
          fechaSalida: fechaSalidaEfectiva,
          tarifaId: ingresoActivo.vehiculo.tarifaId ?? undefined,
        });
        if (cobro.error) throw new AppError(cobro.error, 400);
        valorFacturado = cobro.total;
        tiempoMinutos = cobro.totalMinutos ?? tiempoMinutos;

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
    include: { cliente: true, vehiculo: true, puesto: true, mensualidad: { select: { id: true, fechaInicio: true, fechaFin: true, valor: true, estado: true } } },
    orderBy: { fechaSalida: "desc" },
  });
  res.json({ ok: true, ausencias, pagination });
});

export const obtenerAusencia = asyncHandler(async (req, res) => {
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const { id } = req.params;
  const ausencia = await prisma.ausencia.findFirst({
    where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) },
    include: { cliente: true, vehiculo: true, puesto: true, mensualidad: { select: { id: true, fechaInicio: true, fechaFin: true, valor: true, estado: true } } },
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
    include: { cliente: true, vehiculo: true, puesto: true, mensualidad: { select: { id: true, fechaInicio: true, fechaFin: true, valor: true, estado: true } } },
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
    include: { cliente: true, vehiculo: true, puesto: true, mensualidad: { select: { id: true, fechaInicio: true, fechaFin: true, valor: true, estado: true } } },
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
      include: { cliente: true, vehiculo: true, puesto: true, mensualidad: { select: { id: true, fechaInicio: true, fechaFin: true, valor: true, estado: true } } },
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
      include: { plan: { select: { duracionDias: true } }, facturas: { select: { createdAt: true, valor: true, metodoPago: true, anulada: true } } },
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
      const duracionPlan = Math.max(1, mensualidadAusencia.plan?.duracionDias ?? 30);
      const descuentoSolicitado = redondearDinero((Number(mensualidadAusencia.valor) / duracionPlan) * diasAusente);
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
        const saldoDespues = sumarDinero(saldoAntes, creditoCliente);
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
      include: { cliente: true, vehiculo: true, puesto: true, mensualidad: { select: { id: true, fechaInicio: true, fechaFin: true, valor: true, estado: true } } },
    });
  });

  await registrarMovimiento("AUSENCIAS", "FINALIZAR", `Ausencia #${id} finalizada — ${existente.cliente?.nombres} (${existente.opcion})`, req.usuario?.usuario || "admin");
  res.json({ ok: true, ausencia, mensaje });
});


/**
 * Registra el regreso completo en una sola transacción:
 * compensa la mensualidad, finaliza la ausencia, recupera el puesto
 * y crea el nuevo ingreso. Si cualquier validación falla, nada se guarda.
 */
export const registrarRegresoAusencia = asyncHandler(async (req, res) => {
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const id = Number(req.params.id);
  const diasSolicitados = req.body?.diasCompensacion === undefined ? null : Number(req.body.diasCompensacion);
  if (diasSolicitados !== null && (!Number.isInteger(diasSolicitados) || diasSolicitados < 0 || diasSolicitados > 365)) {
    throw new AppError("Los días de compensación deben ser un entero entre 0 y 365", 400);
  }

  let mensaje = "Regreso registrado correctamente";
  const resultado = await prisma.$transaction(async (tx) => {
    const ausenciaInicial = await tx.ausencia.findFirst({
      where: { id, ...(sucursalId ? { sucursalId } : {}) },
      include: { cliente: true, vehiculo: true, puesto: true },
    });
    if (!ausenciaInicial) throw new AppError("Ausencia no encontrada", 404);
    if (ausenciaInicial.estado !== "ACTIVA") throw new AppError("Esta ausencia ya fue finalizada", 409);
    if (!ausenciaInicial.puestoId) throw new AppError("La ausencia no tiene un puesto reservado. Asigna un puesto antes de registrar el regreso.", 409);

    const vehiculoId = ausenciaInicial.vehiculoId;
    const puestoId = ausenciaInicial.puestoId;
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${vehiculoId}::integer)) AS advisory_lock`;
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${puestoId}::integer)) AS advisory_lock`;

    const [ausencia, cliente, vehiculo, puesto, ingresoActivo] = await Promise.all([
      tx.ausencia.findUnique({ where: { id } }),
      tx.cliente.findUnique({ where: { id: ausenciaInicial.clienteId } }),
      tx.vehiculo.findUnique({ where: { id: vehiculoId } }),
      tx.puesto.findUnique({ where: { id: puestoId } }),
      tx.ingreso.findFirst({ where: { vehiculoId, estado: "ACTIVO" }, select: { id: true } }),
    ]);
    if (!ausencia || ausencia.estado !== "ACTIVA") throw new AppError("La ausencia cambió mientras se procesaba. Actualiza e inténtalo de nuevo.", 409);
    if (!cliente || !vehiculo) throw new AppError("No se encontró el cliente o vehículo asociado", 404);
    if (cliente.bloqueado || vehiculo.bloqueado || !vehiculo.estado) throw new AppError("El cliente o vehículo está bloqueado o inactivo", 409);
    if (vehiculo.clienteId !== cliente.id) throw new AppError("El vehículo ya no pertenece al cliente registrado en la ausencia", 409);
    if (sucursalId && vehiculo.sucursalId !== sucursalId) throw new AppError("El vehículo pertenece a otra sucursal", 403);
    if (!puesto || !puesto.activo || puesto.sucursalId !== vehiculo.sucursalId) throw new AppError("El puesto reservado ya no está disponible o no pertenece a la sucursal del vehículo", 409);
    if (ingresoActivo) throw new AppError("El vehículo ya tiene un ingreso activo", 409);

    const tiposPuesto = String(puesto.tipoPuesto || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    const tipoVehiculo = String(vehiculo.tipo || "").trim().toLowerCase();
    if (tiposPuesto.length && (!tipoVehiculo || (!tiposPuesto.includes(tipoVehiculo) && !tiposPuesto.includes("todos")))) {
      throw new AppError(`El puesto ${puesto.codigo} no admite vehículos de tipo ${vehiculo.tipo || "desconocido"}`, 409);
    }

    const ahora = new Date();
    const [otrosIngresos, otrasMensualidades, otrasReservas, reservaPropia] = await Promise.all([
      tx.ingreso.count({ where: { puestoId, estado: "ACTIVO" } }),
      tx.mensualidad.count({ where: { puestoId, vehiculoId: { not: vehiculoId }, estado: "ACTIVA", fechaInicio: { lte: ahora }, fechaFin: { gte: ahora } } }),
      tx.reserva.count({ where: { puestoId, OR: [{ vehiculoId: null }, { vehiculoId: { not: vehiculoId } }], estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] }, AND: [{ OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] }] } }),
      tx.reserva.findFirst({
        where: { vehiculoId, sucursalId: vehiculo.sucursalId, estado: { in: ["PENDIENTE", "CONFIRMADA"] }, fechaInicio: { lte: ahora }, OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] },
        orderBy: { fechaInicio: "asc" },
      }),
    ]);
    if (reservaPropia?.puestoId && reservaPropia.puestoId !== puestoId) {
      throw new AppError("El vehículo tiene una reserva vigente para otro puesto. Corrige la asignación antes de registrar el regreso.", 409);
    }
    if (otrosIngresos || otrasMensualidades || otrasReservas || puesto.estado === "OCUPADO") {
      throw new AppError("El puesto reservado está ocupado o fue asignado a otro vehículo. No se registró el regreso.", 409);
    }

    const diasAusente = Math.max(1, Math.ceil((ahora.getTime() - ausencia.fechaSalida.getTime()) / 86400000));
    const mensualidad = await tx.mensualidad.findFirst({
      where: {
        ...(ausencia.mensualidadId ? { id: ausencia.mensualidadId } : { vehiculoId }),
        vehiculoId,
        estado: { in: ["ACTIVA", "VENCIDA"] },
        fechaInicio: { lte: ausencia.fechaSalida },
        fechaFin: { gte: ausencia.fechaSalida },
      },
      include: { plan: { select: { duracionDias: true } }, facturas: { select: { createdAt: true, valor: true, metodoPago: true, anulada: true } } },
      orderBy: { fechaInicio: "desc" },
    });

    let diasCompensados = 0;
    let valorCompensado = 0;
    if (mensualidad && (ausencia.opcion === "CONGELAR" || ausencia.opcion === "EXTENDER")) {
      const dias = ausencia.opcion === "EXTENDER" && diasSolicitados !== null ? diasSolicitados : diasAusente;
      if (dias > 0) {
        const nuevaFechaFin = new Date(mensualidad.fechaFin.getTime() + dias * 86400000);
        diasCompensados = dias;
        await tx.mensualidad.update({
          where: { id: mensualidad.id },
          data: {
            fechaFin: nuevaFechaFin,
            estado: "ACTIVA",
            observacion: [mensualidad.observacion, `Ausencia #${id}: ${ausencia.opcion.toLowerCase()} de ${dias} día(s), ${ahora.toISOString()}`].filter(Boolean).join("\n").slice(0, 2000),
          },
        });
        mensaje = `Regreso registrado. Mensualidad compensada ${dias} día(s); nueva fecha de vencimiento: ${nuevaFechaFin.toLocaleDateString("es-CO")}.`;
      } else {
        mensaje = "Regreso registrado sin días adicionales de compensación.";
      }
    } else if (mensualidad && ausencia.opcion === "DESCONTAR") {
      const pagado = calcularPagadoMensualidad(mensualidad.facturas, mensualidad.fechaInicio);
      const duracion = Math.max(1, mensualidad.plan?.duracionDias ?? 30);
      const descuento = redondearDinero((Number(mensualidad.valor) / duracion) * diasAusente);
      const deuda = Math.max(0, restarDinero(mensualidad.valor, pagado));
      const reduccion = Math.min(descuento, deuda);
      const credito = Math.max(0, restarDinero(descuento, reduccion));
      diasCompensados = diasAusente;
      valorCompensado = descuento;
      if (reduccion > 0) {
        await tx.mensualidad.update({
          where: { id: mensualidad.id },
          data: {
            valor: Math.max(pagado, restarDinero(mensualidad.valor, reduccion)),
            observacion: [mensualidad.observacion, `Ausencia #${id}: descuento de deuda por ${reduccion.toLocaleString("es-CO")}`].filter(Boolean).join("\n").slice(0, 2000),
          },
        });
      }
      if (credito > 0) {
        await tx.$queryRaw`SELECT "id" FROM "Cliente" WHERE "id" = ${cliente.id} FOR UPDATE`;
        const actual = await tx.cliente.findUnique({ where: { id: cliente.id }, select: { saldo: true } });
        const antes = redondearDinero(actual?.saldo ?? 0);
        const despues = sumarDinero(antes, credito);
        await tx.cliente.update({ where: { id: cliente.id }, data: { saldo: despues } });
        await tx.clienteSaldoMovimiento.create({
          data: { clienteId: cliente.id, tipo: "DEVOLUCION", monto: credito, saldoAntes: antes, saldoDespues: despues, concepto: `Compensación por ausencia #${id} — vehículo ${vehiculo.placa}`, usuario: req.usuario?.usuario || "admin" },
        });
      }
      mensaje = `Regreso registrado. Compensación: ${descuento.toLocaleString("es-CO")}; deuda reducida: ${reduccion.toLocaleString("es-CO")}; saldo a favor: ${credito.toLocaleString("es-CO")}.`;
    } else if (ausencia.opcion === "MANTENER") {
      mensaje = "Regreso registrado. La mensualidad se mantuvo sin cambios.";
    } else if (ausencia.opcion === "HISTORIAL") {
      mensaje = "Regreso registrado. La ausencia quedó únicamente en el historial.";
    } else if (!mensualidad) {
      mensaje = "Regreso registrado. No se encontró una mensualidad vigente en la fecha de salida para compensar.";
    }

    const puestoActualizado = await tx.puesto.updateMany({
      where: { id: puestoId, estado: { in: ["AUSENCIA", "RESERVADO", "LIBRE"] }, activo: true },
      data: { estado: "OCUPADO" },
    });
    if (puestoActualizado.count !== 1) throw new AppError("No se pudo recuperar el puesto reservado. No se registró el regreso.", 409);

    if (reservaPropia) {
      await tx.reserva.update({ where: { id: reservaPropia.id }, data: { estado: "ACTIVA" } });
    }
    const ingreso = await tx.ingreso.create({
      data: { clienteId: cliente.id, vehiculoId, puestoId, ...(reservaPropia ? { reservaId: reservaPropia.id } : {}) },
      include: { cliente: true, vehiculo: true, puesto: true },
    });
    const ausenciaFinalizada = await tx.ausencia.update({
      where: { id },
      data: {
        estado: "FINALIZADA", fechaRegreso: ahora,
        diasCompensados, valorCompensado,
        compensacionDetalle: mensaje,
        compensacionAplicadaAt: ahora,
      },
      include: { cliente: true, vehiculo: true, puesto: true, mensualidad: { select: { id: true, fechaInicio: true, fechaFin: true, valor: true, estado: true } } },
    });
    await tx.cliente.update({ where: { id: cliente.id }, data: { estado: "ACTIVO" } });
    return { ausencia: ausenciaFinalizada, ingreso };
  });

  await registrarMovimiento("AUSENCIAS", "REGRESO", `Regreso de ausencia #${id} — vehículo ${resultado.ingreso.vehiculo.placa}, puesto ${resultado.ingreso.puesto.codigo}`, req.usuario?.usuario || "admin");
  await registrarMovimiento("INGRESOS", "ENTRADA", `Vehículo ${resultado.ingreso.vehiculo.placa} regresó de ausencia al puesto ${resultado.ingreso.puesto.codigo}`, req.usuario?.usuario || "admin");
  emitirEvento("ingreso:entrada", {
    mensaje: `Vehículo ${resultado.ingreso.vehiculo.placa} regresó y ocupó el puesto ${resultado.ingreso.puesto.codigo}`,
    cliente: resultado.ingreso.cliente,
    vehiculo: resultado.ingreso.vehiculo,
    puesto: resultado.ingreso.puesto,
    fecha: resultado.ingreso.fechaEntrada,
    tipoIngreso: "regreso_ausencia",
  });
  res.status(201).json({ ok: true, ...resultado, mensaje });
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

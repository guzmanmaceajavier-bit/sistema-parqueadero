import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { generarNumeroFactura } from "../../services/facturaCounter.js";
import { resolverSucursalPermitida } from "../../utils/sucursalAccess.js";
import { calcularCobro } from "../../services/calculadorCobros.js";
import { calcularPagadoMensualidad } from "../../utils/saldos.js";

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
    const ingresoActivo = await tx.ingreso.findFirst({
      where: { vehiculoId: vid, estado: "ACTIVO" },
      include: { puesto: true, vehiculo: true },
    });
    if (ingresoActivo?.puestoId) {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${ingresoActivo.puestoId}::integer)) AS advisory_lock`;
    }

    const a = await tx.ausencia.create({
      data: {
        clienteId: cid, vehiculoId: vid, sucursalId: vehiculo.sucursalId ?? sucursalId ?? null,
        fechaSalida: fechaSalida ? new Date(fechaSalida) : new Date(), fechaRegreso: fechaRegreso ? new Date(fechaRegreso) : null, motivo, opcion: opcion || "HISTORIAL",
      },
      include: { cliente: true, vehiculo: true },
    });

    if (ingresoActivo) {
      const ahora = new Date();
      const tiempoMinutos = Math.ceil((ahora.getTime() - ingresoActivo.fechaEntrada.getTime()) / (1000 * 60));
      const sucursalIngreso = ingresoActivo.vehiculo.sucursalId ?? sucursalId ?? null;

      // La ausencia aplica exactamente la misma regla de cobertura que una salida
      // normal: solo una mensualidad totalmente pagada y vigente evita el cobro.
      const planActivo = await tx.mensualidad.findFirst({
        where: {
          vehiculoId: vid,
          sucursalId: sucursalIngreso,
          estado: "ACTIVA",
          fechaInicio: { lte: ahora },
          fechaFin: { gte: ahora },
          OR: [{ puestoId: null }, { puestoId: ingresoActivo.puestoId }],
        },
        include: { facturas: { select: { createdAt: true, valor: true, metodoPago: true, anulada: true } } },
      });
      const coberturaPagada = !!planActivo
        && calcularPagadoMensualidad(planActivo.facturas, planActivo.fechaInicio) >= planActivo.valor;

      let valorFacturado = 0;
      if (!coberturaPagada) {
        // No duplicar una fórmula simplificada: reutilizar el calculador central
        // para respetar modalidad, cortesías, minutos gratis, progresivas y topes.
        const cobro = await calcularCobro({
          ingreso: ingresoActivo,
          tipoVehiculo: ingresoActivo.vehiculo.tipo || undefined,
          fechaSalida: ahora,
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
        data: { fechaSalida: ahora, estado: "FINALIZADO", tiempoMinutos, valorPagado: valorFacturado },
      });
      if (ingresoActivo.puestoId) {
        await tx.puesto.update({ where: { id: ingresoActivo.puestoId }, data: { estado: "AUSENCIA" } });
      }
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
  const existente = await prisma.ausencia.findFirst({
    where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) },
    include: { cliente: true, vehiculo: true },
  });
  if (!existente) throw new AppError("Ausencia no encontrada", 404);
  if (existente.estado === "FINALIZADA") throw new AppError("La ausencia ya está finalizada", 400);

  let mensaje = "Ausencia finalizada";

  const ausencia = await prisma.$transaction(async (tx) => {
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

    const ingresoAusencia = await tx.ingreso.findFirst({
      where: { vehiculoId: a.vehiculoId, ...(sucursalId ? { vehiculo: { sucursalId } } : {}), estado: "FINALIZADO", fechaSalida: { gte: existente.fechaSalida } },
      orderBy: { fechaSalida: "desc" },
    });
    if (ingresoAusencia?.puestoId) {
      const ahora = new Date();
      const [ingresoActivoPuesto, mensualidadActivaPuesto, reservaActivaPuesto] = await Promise.all([
        tx.ingreso.count({ where: { puestoId: ingresoAusencia.puestoId, estado: "ACTIVO" } }),
        tx.mensualidad.count({
          where: {
            puestoId: ingresoAusencia.puestoId,
            estado: "ACTIVA",
            fechaFin: { gte: ahora },
          },
        }),
        tx.reserva.count({
          where: {
            puestoId: ingresoAusencia.puestoId,
            estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }],
          },
        }),
      ]);
      // Un plan o reserva conserva el puesto reservado, pero no ocupado:
      // el vehículo todavía no ha reingresado físicamente.
      const nuevoEstado = ingresoActivoPuesto > 0
        ? "OCUPADO"
        : mensualidadActivaPuesto > 0 || reservaActivaPuesto > 0
          ? "RESERVADO"
          : "LIBRE";
      await tx.puesto.update({ where: { id: ingresoAusencia.puestoId }, data: { estado: nuevoEstado } });
    }

    if (existente.opcion === "CONGELAR") {
      const mensualidades = await tx.mensualidad.findMany({ where: { vehiculoId: a.vehiculoId, ...(sucursalId ? { sucursalId } : {}), estado: "ACTIVA" } });
      for (const m of mensualidades) {
        const nuevaFechaFin = new Date(m.fechaFin.getTime() + diasAusente * 86400000);
        await tx.mensualidad.update({ where: { id: m.id }, data: { fechaFin: nuevaFechaFin } });
        mensaje = `Mensualidad congelada — nueva fecha fin: ${nuevaFechaFin.toLocaleDateString("es-CO")}`;
      }
    } else if (existente.opcion === "EXTENDER") {
      const mensualidades = await tx.mensualidad.findMany({ where: { vehiculoId: a.vehiculoId, ...(sucursalId ? { sucursalId } : {}), estado: "ACTIVA" } });
      for (const m of mensualidades) {
        const nuevaFechaFin = new Date(m.fechaFin.getTime() + diasAusente * 86400000);
        await tx.mensualidad.update({ where: { id: m.id }, data: { fechaFin: nuevaFechaFin } });
        mensaje = `Vencimiento extendido ${diasAusente} día(s) — nueva fecha fin: ${nuevaFechaFin.toLocaleDateString("es-CO")}`;
      }
    } else if (existente.opcion === "DESCONTAR") {
      const mensualidades = await tx.mensualidad.findMany({ where: { vehiculoId: a.vehiculoId, ...(sucursalId ? { sucursalId } : {}), estado: "ACTIVA" } });
      for (const m of mensualidades) {
        const valorDia = m.valor / 30;
        const descuento = Math.round(valorDia * diasAusente * 100) / 100;
        const nuevoValor = Math.max(0, m.valor - descuento);
        await tx.mensualidad.update({ where: { id: m.id }, data: { valor: nuevoValor } });
        mensaje = `Descontados $${descuento.toLocaleString()} — nuevo valor mensualidad: $${nuevoValor.toLocaleString()}`;
      }
    } else if (existente.opcion === "MANTENER") {
      mensaje = "Ausencia finalizada — cobro normal (sin cambios en mensualidad)";
    }

    return a;
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

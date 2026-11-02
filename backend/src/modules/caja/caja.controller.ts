import bcrypt from "bcrypt";
import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { emitirEvento } from "../../services/socket.js";
import { paginate } from "../../utils/pagination.js";
import { calcularTotalesHelper } from "./caja.helpers.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";

export const abrirCaja = asyncHandler(async (req, res) => {
  const { apertura, password, observacion } = req.body;

  const caja = await prisma.$transaction(async (tx) => {
    // Serializa aperturas para evitar que dos solicitudes creen cajas abiertas simultáneas.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124019)`;
    const abierta = await tx.caja.findFirst({ where: { estado: "ABIERTA" } });
    if (abierta) throw new AppError("Ya hay una caja abierta", 400);

    const usuario = await tx.usuario.findUnique({ where: { id: req.usuario.id } });
    if (!usuario) throw new AppError("Usuario no encontrado", 404);

    const valida = await bcrypt.compare(password, usuario.password);
    if (!valida) throw new AppError("Contraseña incorrecta", 401);

    return tx.caja.create({
      data: { apertura: Number(apertura), observacion, usuarioId: req.usuario.id },
    });
  });

  await registrarMovimiento("CAJA", "ABRIR", `Caja abierta por ${req.usuario?.usuario} con apertura de $${Number(apertura)}`, req.usuario?.usuario);
  emitirEvento("caja:abierta", { mensaje: "Caja abierta", caja });

  res.status(201).json({ ok: true, caja: { ...caja, ingresos: 0, egresos: 0, saldo: Number(apertura) } });
});

export const cerrarCaja = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { observacion, conteo } = req.body;

  const resultado = await prisma.$transaction(async (tx) => {
    // Comparte el bloqueo global con la apertura para evitar cierres/aperturas solapados.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124019)`;
    const caja = await tx.caja.findUnique({ where: { id: Number(id) } });
    if (!caja) throw new AppError("Caja no encontrada", 404);
    if (caja.estado !== "ABIERTA") throw new AppError("La caja ya está cerrada", 409);

    const totales = await calcularTotalesHelper(caja.id, tx);
    const esperado = caja.apertura + totales.ingresosEfectivo - totales.egresosEfectivo;
    let obsFinal = observacion || "";
    let totalConteo = 0;
    let diferencia = 0;

    if (conteo) {
      for (const [denom, count] of Object.entries(conteo.billetes || {})) {
        totalConteo += Number(denom) * (Number(count) || 0);
      }
      for (const [denom, count] of Object.entries(conteo.monedas || {})) {
        totalConteo += Number(denom) * (Number(count) || 0);
      }
      diferencia = totalConteo - esperado;
      const arqueoData = { conteo, totalConteo, esperado, diferencia };
      obsFinal = obsFinal ? obsFinal + "\n" + JSON.stringify(arqueoData) : JSON.stringify(arqueoData);
    }

    const actualizada = await tx.caja.updateMany({
      where: { id: Number(id), estado: "ABIERTA" },
      data: { cierre: esperado, observacion: obsFinal, estado: "CERRADA" },
    });
    if (actualizada.count !== 1) throw new AppError("La caja fue cerrada por otra operación", 409);

    const cajaCerrada = await tx.caja.findUniqueOrThrow({ where: { id: Number(id) } });
    return { caja: cajaCerrada, totales, totalConteo, esperado, diferencia };
  });

  await registrarMovimiento("CAJA", "CERRAR", `Caja #${id} cerrada — Efectivo $${resultado.esperado} (Ingresos: $${resultado.totales.ingresos}, Egresos: $${resultado.totales.egresos})`, req.usuario?.usuario);
  emitirEvento("caja:cerrada", { mensaje: "Caja cerrada", caja: resultado.caja });

  res.json({ ok: true, caja: { ...resultado.caja, ...resultado.totales }, totalConteo: resultado.totalConteo, esperado: resultado.esperado, diferencia: resultado.diferencia });
});

export const obtenerCajaActiva = asyncHandler(async (req, res) => {
  const caja = await prisma.caja.findFirst({
    where: { estado: "ABIERTA" },
    include: { usuario: { select: { id: true, nombre: true, usuario: true } } },
  });
  if (!caja) return res.json({ ok: true, caja: null });

  const totales = await calcularTotalesHelper(caja.id);
  res.json({
    ok: true,
    caja: {
      ...caja,
      ...totales,
      saldo: caja.apertura + totales.ingresos - totales.egresos,
      efectivoEnCaja: caja.apertura + totales.ingresosEfectivo - totales.egresosEfectivo,
    },
  });
});

export const obtenerCajas = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { data: cajas, pagination } = await paginate(prisma, "caja", {
    page, limit,
    orderBy: { id: "desc" },
    include: {
      usuario: { select: { id: true, nombre: true, usuario: true } },
    },
  });
  res.json({ ok: true, cajas, pagination });
});

export const obtenerCaja = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const caja = await prisma.caja.findUnique({
    where: { id: Number(id) },
    include: {
      movimientos: { orderBy: { createdAt: "desc" } },
      usuario: { select: { id: true, nombre: true, usuario: true } },
    },
  });
  if (!caja) throw new AppError("Caja no encontrada", 404);

  const totales = await calcularTotalesHelper(caja.id);
  res.json({ ok: true, caja: { ...caja, ...totales, saldo: caja.apertura + totales.ingresos - totales.egresos } });
});

export const actualizarCaja = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { apertura, observacion } = req.body;

  const caja = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124019)`;
    const existente = await tx.caja.findUnique({ where: { id: Number(id) } });
    if (!existente) throw new AppError("Caja no encontrada", 404);

    const data: any = {};
    if (apertura !== undefined) {
      const aperturaNormalizada = Number(apertura);
      if (!Number.isFinite(aperturaNormalizada) || aperturaNormalizada < 0) {
        throw new AppError("El fondo de apertura debe ser un valor válido y no negativo", 400);
      }
      if (existente.estado !== "ABIERTA") {
        throw new AppError("No se puede modificar el fondo de apertura de una caja cerrada", 409);
      }
      const movimientos = await tx.cajaMovimiento.count({ where: { cajaId: existente.id } });
      if (movimientos > 0) {
        throw new AppError("No se puede cambiar el fondo de apertura después del primer movimiento. Registra un ajuste auditado en lugar de alterar el saldo inicial.", 409);
      }
      data.apertura = aperturaNormalizada;
    }
    if (observacion !== undefined) {
      if (typeof observacion !== "string" || observacion.length > 500) {
        throw new AppError("La observación debe tener máximo 500 caracteres", 400);
      }
      data.observacion = observacion.trim();
    }
    if (Object.keys(data).length === 0) throw new AppError("No hay cambios válidos para guardar", 400);

    return tx.caja.update({ where: { id: Number(id) }, data });
  });

  await registrarMovimiento("CAJA", "EDITAR", `Caja #${id} actualizada${apertura !== undefined ? ` — fondo de apertura: $${caja.apertura}` : ""}`, req.usuario?.usuario);
  emitirEvento("caja:actualizada", { mensaje: `Caja #${id} actualizada`, caja });
  res.json({ ok: true, caja });
});

export const obtenerMovimientosCaja = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tipo, metodoPago, q, page, limit } = req.query;

  const caja = await prisma.caja.findUnique({ where: { id: Number(id) } });
  if (!caja) throw new AppError("Caja no encontrada", 404);

  const where = { cajaId: caja.id };
  if (tipo) where.tipo = tipo;
  if (metodoPago) where.metodoPago = metodoPago;
  if (q) {
    where.OR = [
      { concepto: { contains: q, mode: "insensitive" } },
    ];
  }

  const { data: movimientos, pagination } = await paginate(prisma, "cajaMovimiento", {
    page, limit, where,
    orderBy: { createdAt: "desc" },
    include: {
      factura: {
        select: {
          numero: true, origen: true, valor: true, metodoPago: true,
          ingreso: {
            select: {
              vehiculo: { select: { placa: true, marca: true, tipo: true } },
              cliente: { select: { nombres: true, apellidos: true } },
              fechaEntrada: true, fechaSalida: true, tiempoMinutos: true,
            },
          },
          mensualidad: {
            select: {
              cliente: { select: { nombres: true, apellidos: true } },
              vehiculo: { select: { placa: true, marca: true } },
              plan: { select: { nombre: true } },
            },
          },
        },
      },
      gasto: { select: { concepto: true, categoria: true, descripcion: true, fecha: true } },
    },
  });

  const totalMovs = await prisma.cajaMovimiento.findMany({ where: { ...where, anulado: false }, select: { monto: true, tipo: true, metodoPago: true } });
  const ingresos = totalMovs.filter(m => m.tipo === "INGRESO");
  const egresos = totalMovs.filter(m => m.tipo === "EGRESO");
  const resumen = {
    total: totalMovs.reduce((s, m) => s + m.monto, 0),
    ingresos: ingresos.reduce((s, m) => s + m.monto, 0),
    egresos: egresos.reduce((s, m) => s + m.monto, 0),
    ingresosEfectivo: ingresos.filter(m => (m.metodoPago || "efectivo") === "efectivo").reduce((s, m) => s + m.monto, 0),
    ingresosTarjeta: ingresos.filter(m => m.metodoPago === "tarjeta").reduce((s, m) => s + m.monto, 0),
    ingresosTransferencia: ingresos.filter(m => m.metodoPago === "transferencia").reduce((s, m) => s + m.monto, 0),
  };

  res.json({ ok: true, movimientos, resumen, pagination });
});

export const eliminarCaja = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existente = await prisma.caja.findUnique({ where: { id: Number(id) } });
  if (!existente) throw new AppError("Caja no encontrada", 404);

  throw new AppError("No se pueden eliminar cajas cerradas. El historial de caja debe preservarse para auditoría.", 400);
});

export const eliminarMovimientoCaja = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const anulado = await prisma.$transaction(async (tx) => {
    // El mismo bloqueo protege el cierre: un movimiento no cambia durante el arqueo.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124019)`;
    const movimiento = await tx.cajaMovimiento.findUnique({ where: { id: Number(id) } });
    if (!movimiento) throw new AppError("Movimiento no encontrado", 404);
    const caja = await tx.caja.findUnique({ where: { id: movimiento.cajaId } });
    if (caja && caja.estado === "CERRADA") throw new AppError("No se puede anular un movimiento de una caja cerrada", 400);
    if (movimiento.anulado) throw new AppError("Este movimiento ya fue anulado", 409);
    if (movimiento.facturaId || movimiento.gastoId) {
      throw new AppError("Este movimiento está vinculado a una factura o gasto. Corrige o anula la operación desde su módulo de origen para conservar la consistencia financiera.", 409);
    }
    const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim().slice(0, 500) : "";
    return tx.cajaMovimiento.update({
      where: { id: Number(id) },
      data: {
        anulado: true,
        anuladoEn: new Date(),
        anuladoPor: req.usuario?.usuario || "usuario",
        motivoAnulacion: motivo || "Anulación solicitada desde el módulo de caja",
      },
    });
  });
  await registrarMovimiento("CAJA", "ANULAR", `Movimiento #${id} anulado: ${anulado.concepto} - ${anulado.monto}. Motivo: ${anulado.motivoAnulacion}`, req.usuario?.usuario);
  emitirEvento("caja:movimiento-actualizado", { mensaje: `Movimiento #${id} anulado` });
  res.json({ ok: true, message: "Movimiento anulado; el registro se conserva para auditoría", movimiento: anulado });
});

export const actualizarMovimientoCaja = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { concepto, monto, metodoPago } = req.body;
  const actualizado = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124019)`;
    const movimiento = await tx.cajaMovimiento.findUnique({ where: { id: Number(id) } });
    if (!movimiento) throw new AppError("Movimiento no encontrado", 404);
    if (movimiento.anulado) throw new AppError("No se puede editar un movimiento anulado", 409);
    if (movimiento.facturaId || movimiento.gastoId) {
      throw new AppError("Este movimiento proviene de una factura o gasto. Modifica la operación desde su módulo de origen.", 409);
    }
    const caja = await tx.caja.findUnique({ where: { id: movimiento.cajaId } });
    if (caja && caja.estado === "CERRADA") throw new AppError("No se puede modificar una caja cerrada", 400);
    const data: any = {};
    if (concepto !== undefined) {
      if (typeof concepto !== "string" || !concepto.trim() || concepto.trim().length > 255) {
        throw new AppError("El concepto debe tener entre 1 y 255 caracteres", 400);
      }
      data.concepto = concepto.trim();
    }
    if (monto !== undefined) {
      const montoNormalizado = Number(monto);
      if (!Number.isFinite(montoNormalizado) || montoNormalizado <= 0) throw new AppError("El monto debe ser un número mayor que cero", 400);
      data.monto = montoNormalizado;
    }
    if (metodoPago !== undefined) {
      if (typeof metodoPago !== "string" || !metodoPago.trim() || metodoPago.trim().length > 60) {
        throw new AppError("El método de pago no es válido", 400);
      }
      data.metodoPago = metodoPago.trim();
    }
    if (Object.keys(data).length === 0) throw new AppError("No hay cambios válidos para guardar", 400);
    return tx.cajaMovimiento.update({ where: { id: Number(id) }, data });
  });
  await registrarMovimiento("CAJA", "EDITAR", `Movimiento #${id} editado: ${actualizado.concepto} - $${actualizado.monto}`, req.usuario?.usuario);
  emitirEvento("caja:movimiento-actualizado", { mensaje: `Movimiento #${id} actualizado` });
  res.json({ ok: true, movimiento: actualizado });
});

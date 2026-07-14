import bcrypt from "bcrypt";
import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { emitirEvento } from "../../services/socket.js";
import { paginate } from "../../utils/pagination.js";
import { calcularTotalesHelper } from "./caja.helpers.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";

export const abrirCaja = asyncHandler(async (req, res) => {
  const { apertura, password, observacion } = req.body;

  const abierta = await prisma.caja.findFirst({ where: { estado: "ABIERTA" } });
  if (abierta) throw new AppError("Ya hay una caja abierta", 400);

  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
  if (!usuario) throw new AppError("Usuario no encontrado", 404);

  const valida = await bcrypt.compare(password, usuario.password);
  if (!valida) throw new AppError("Contraseña incorrecta", 401);

  const caja = await prisma.caja.create({
    data: { apertura: Number(apertura), observacion, usuarioId: req.usuario.id },
  });

  await registrarMovimiento("CAJA", "ABRIR", `Caja abierta por ${req.usuario?.usuario} con apertura de $${Number(apertura)}`, req.usuario?.usuario);
  emitirEvento("caja:abierta", { mensaje: "Caja abierta", caja });

  res.status(201).json({ ok: true, caja: { ...caja, ingresos: 0, egresos: 0, saldo: Number(apertura) } });
});

export const cerrarCaja = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { observacion, conteo } = req.body;

  const caja = await prisma.caja.findUnique({ where: { id: Number(id) } });
  if (!caja) throw new AppError("Caja no encontrada", 404);
  if (caja.estado === "CERRADA") throw new AppError("La caja ya está cerrada", 400);

  const totales = await calcularTotalesHelper(caja.id);
  const esperado = caja.apertura + totales.ingresosEfectivo - totales.egresos;

  let obsFinal = observacion || "";
  let totalConteo = 0;
  let diferencia = 0;

  if (conteo) {
    // Calculate total from conteo
    if (conteo.billetes) {
      for (const [denom, count] of Object.entries(conteo.billetes)) {
        totalConteo += parseInt(denom) * (Number(count) || 0);
      }
    }
    if (conteo.monedas) {
      for (const [denom, count] of Object.entries(conteo.monedas)) {
        totalConteo += parseInt(denom) * (Number(count) || 0);
      }
    }
    diferencia = totalConteo - esperado;
    const arqueoData = { conteo, totalConteo, esperado, diferencia };
    obsFinal = obsFinal
      ? obsFinal + "\n" + JSON.stringify(arqueoData)
      : JSON.stringify(arqueoData);
  }

  const actualizada = await prisma.caja.update({
    where: { id: Number(id) },
    data: { cierre: esperado, observacion: obsFinal, estado: "CERRADA" },
  });

  await registrarMovimiento("CAJA", "CERRAR", `Caja #${id} cerrada — Efectivo $${esperado} (Ingresos: $${totales.ingresos}, Egresos: $${totales.egresos})`, req.usuario?.usuario);
  emitirEvento("caja:cerrada", { mensaje: "Caja cerrada", caja: actualizada });

  res.json({ ok: true, caja: { ...actualizada, ...totales }, totalConteo, esperado, diferencia });
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
      efectivoEnCaja: caja.apertura + totales.ingresosEfectivo - totales.egresos,
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

  const existente = await prisma.caja.findUnique({ where: { id: Number(id) } });
  if (!existente) throw new AppError("Caja no encontrada", 404);

  const data = {};
  if (apertura !== undefined) data.apertura = Number(apertura);
  if (observacion !== undefined) data.observacion = observacion;

  const caja = await prisma.caja.update({ where: { id: Number(id) }, data });
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

  const totalMovs = await prisma.cajaMovimiento.findMany({ where, select: { monto: true, tipo: true, metodoPago: true } });
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
  if (existente.estado === "ABIERTA") throw new AppError("No se puede eliminar una caja abierta. Ciérrela primero.", 400);

  await prisma.$transaction(async (tx) => {
    await tx.cajaMovimiento.deleteMany({ where: { cajaId: Number(id) } });
    await tx.caja.delete({ where: { id: Number(id) } });
  });
  await registrarMovimiento("CAJA", "ELIMINAR", `Caja #${id} eliminada con sus movimientos`, req.usuario?.usuario);
  res.json({ ok: true, mensaje: "Caja eliminada" });
});

export const eliminarMovimientoCaja = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const movimiento = await prisma.cajaMovimiento.findUnique({ where: { id: Number(id) } });
  if (!movimiento) throw new AppError("Movimiento no encontrado", 404);

  const caja = await prisma.caja.findUnique({ where: { id: movimiento.cajaId } });
  if (caja && caja.estado === "CERRADA") throw new AppError("No se puede modificar una caja cerrada", 400);

  await prisma.cajaMovimiento.delete({ where: { id: Number(id) } });
  await registrarMovimiento("CAJA", "ANULAR", `Movimiento #${id} anulado: ${movimiento.concepto} - $${movimiento.monto}`, req.usuario?.usuario);
  emitirEvento("caja:movimiento-eliminado", { mensaje: `Movimiento #${id} anulado` });
  res.json({ ok: true, mensaje: "Movimiento anulado" });
});

export const actualizarMovimientoCaja = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { concepto, monto, metodoPago } = req.body;

  const movimiento = await prisma.cajaMovimiento.findUnique({ where: { id: Number(id) } });
  if (!movimiento) throw new AppError("Movimiento no encontrado", 404);

  const caja = await prisma.caja.findUnique({ where: { id: movimiento.cajaId } });
  if (caja && caja.estado === "CERRADA") throw new AppError("No se puede modificar una caja cerrada", 400);

  const data = {};
  if (concepto !== undefined) data.concepto = concepto;
  if (monto !== undefined) data.monto = Number(monto);
  if (metodoPago !== undefined) data.metodoPago = metodoPago;

  const actualizado = await prisma.cajaMovimiento.update({ where: { id: Number(id) }, data });
  await registrarMovimiento("CAJA", "EDITAR", `Movimiento #${id} editado: ${actualizado.concepto} - $${actualizado.monto}`, req.usuario?.usuario);
  emitirEvento("caja:movimiento-actualizado", { mensaje: `Movimiento #${id} actualizado` });
  res.json({ ok: true, movimiento: actualizado });
});

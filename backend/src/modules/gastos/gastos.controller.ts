import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { emitirEvento } from "../../services/socket.js";
import { getCajaOError } from "../../helpers/caja.js";

function calcularProximaGeneracion(periodicidad) {
  const ahora = new Date();
  switch (periodicidad) {
    case "semanal": return new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "mensual": return new Date(ahora.getFullYear(), ahora.getMonth() + 1, ahora.getDate());
    case "anual": return new Date(ahora.getFullYear() + 1, ahora.getMonth(), ahora.getDate());
    default: return null;
  }
}

export const crearGasto = asyncHandler(async (req, res) => {
  const { concepto, descripcion, categoria, valor, recurrente, periodicidad } = req.body;
  if (!concepto) throw new AppError("Concepto es requerido", 400);

  await getCajaOError();

  const [gasto] = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124019)`;
    const cajaAbierta = await tx.caja.findFirst({ where: { estado: "ABIERTA" } });
    if (!cajaAbierta) throw new AppError("La caja se cerró antes de registrar el gasto", 409);
    const data = { concepto, descripcion, categoria: categoria || "otros", valor: Number(valor) };
    if (recurrente) {
      data.recurrente = true;
      data.periodicidad = periodicidad || "mensual";
      data.proximaGeneracion = calcularProximaGeneracion(periodicidad || "mensual");
    }
    const g = await tx.gasto.create({ data });
    await tx.cajaMovimiento.create({
      data: { cajaId: cajaAbierta.id, tipo: "EGRESO", concepto: `Gasto: ${g.concepto}`, monto: Number(valor), gastoId: g.id },
    });
    return [g];
  });

  await registrarMovimiento("GASTOS", "CREAR", `Gasto: ${gasto.concepto} - $${gasto.valor}`, req.usuario?.usuario || "admin");
  emitirEvento("gasto:creado", { mensaje: `Gasto registrado: ${gasto.concepto} - $${gasto.valor}`, gasto });
  res.status(201).json({ ok: true, gasto });
});

export const obtenerGastos = asyncHandler(async (req, res) => {
  const { page, limit, q, fechaInicio, fechaFin } = req.query;
  const where = {};
  if (q) {
    where.OR = [
      { concepto: { contains: q, mode: "insensitive" } },
      { descripcion: { contains: q, mode: "insensitive" } },
      { categoria: { contains: q, mode: "insensitive" } },
    ];
  }
  if (fechaInicio || fechaFin) {
    where.fecha = {};
    if (fechaInicio) where.fecha.gte = new Date(fechaInicio);
    if (fechaFin) where.fecha.lte = new Date(fechaFin + "T23:59:59.999Z");
  }
  const { data: gastos, pagination } = await paginate(prisma, "gasto", {
    page, limit, where, orderBy: { id: "desc" },
  });
  res.json({ ok: true, gastos, pagination });
});

export const obtenerGasto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const gasto = await prisma.gasto.findUnique({ where: { id: Number(id) } });
  if (!gasto) throw new AppError("Gasto no encontrado", 404);
  res.json({ ok: true, gasto });
});

export const actualizarGasto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { concepto, descripcion, categoria, valor, recurrente, periodicidad } = req.body;
  const data: any = {};
  if (concepto !== undefined) data.concepto = concepto;
  if (descripcion !== undefined) data.descripcion = descripcion;
  if (categoria !== undefined) data.categoria = categoria;
  if (valor !== undefined) {
    const valorNormalizado = Number(valor);
    if (!Number.isFinite(valorNormalizado) || valorNormalizado <= 0) throw new AppError("El valor del gasto debe ser mayor que cero", 400);
    data.valor = valorNormalizado;
  }
  if (recurrente !== undefined) data.recurrente = recurrente;
  if (periodicidad !== undefined) data.periodicidad = periodicidad;
  if (recurrente && periodicidad) data.proximaGeneracion = calcularProximaGeneracion(periodicidad);

  const gasto = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124019)`;
    const existe = await tx.gasto.findUnique({ where: { id: Number(id) } });
    if (!existe) throw new AppError("Gasto no encontrado", 404);
    const movimientos = await tx.cajaMovimiento.findMany({
      where: { gastoId: Number(id) },
      include: { caja: true },
    });
    if (movimientos.some(m => m.anulado)) throw new AppError("No se puede modificar un gasto con movimientos anulados", 409);
    if (movimientos.some(m => m.caja?.estado === "CERRADA")) {
      throw new AppError("No se puede modificar un gasto que pertenece a una caja cerrada", 400);
    }

    const actualizado = await tx.gasto.update({ where: { id: Number(id) }, data });
    const movimientoData: any = {};
    if (concepto !== undefined) movimientoData.concepto = `Gasto: ${actualizado.concepto}`;
    if (valor !== undefined) movimientoData.monto = Number(valor);
    if (movimientos.length > 0 && Object.keys(movimientoData).length) {
      await tx.cajaMovimiento.updateMany({ where: { gastoId: Number(id), anulado: false }, data: movimientoData });
    }
    return actualizado;
  });

  await registrarMovimiento("GASTOS", "ACTUALIZAR", `Gasto #${id}: ${gasto.concepto} - $${gasto.valor}`, req.usuario?.usuario || "admin");
  emitirEvento("gasto:actualizado", { mensaje: `Gasto #${id} actualizado`, gasto });
  res.json({ ok: true, gasto });
});

export const eliminarGasto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const gasto = await prisma.gasto.findUnique({ where: { id: Number(id) } });
  if (!gasto) throw new AppError("Gasto no encontrado", 404);

  const movimientos = await prisma.cajaMovimiento.findMany({
    where: { gastoId: Number(id) },
    include: { caja: true },
  });
  if (movimientos.some(m => !m.anulado && m.caja?.estado === "CERRADA")) {
    throw new AppError("No se puede eliminar un gasto que participó en una caja cerrada. El registro financiero debe conservarse.", 409);
  }

  await prisma.$transaction(async (tx) => {
    if (movimientos.length > 0) {
      await tx.cajaMovimiento.updateMany({
        where: { gastoId: Number(id) },
        data: {
          anulado: true,
          anuladoEn: new Date(),
          anuladoPor: req.usuario?.usuario || "usuario",
          motivoAnulacion: "Gasto eliminado desde el módulo de gastos",
          gastoId: null,
          concepto: `Gasto anulado: ${gasto.concepto}`,
        },
      });
    }
    await tx.gasto.delete({ where: { id: Number(id) } });
  });
  await registrarMovimiento("GASTOS", "ELIMINAR", `Gasto #${id} eliminado y movimiento(s) de caja anulados: ${gasto.concepto} - $${gasto.valor}`, req.usuario?.usuario || "admin");
  emitirEvento("gasto:eliminado", { mensaje: `Gasto #${id} eliminado: ${gasto.concepto}`, gasto });
  res.json({ ok: true, message: "Gasto eliminado; sus movimientos se conservaron como anulados para auditoría" });
});

export const generarRecurrentes = asyncHandler(async (req, res) => {
  const ahora = new Date();
  const pendientes = await prisma.gasto.findMany({
    where: { recurrente: true, proximaGeneracion: { lte: ahora } },
  });

  let generados = 0;
  for (const g of pendientes) {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124019)`;
      const cajaAbierta = await tx.caja.findFirst({ where: { estado: "ABIERTA" } });
      await tx.gasto.create({
        data: {
          concepto: g.concepto,
          descripcion: g.descripcion,
          categoria: g.categoria,
          valor: g.valor,
          fecha: ahora,
        },
      });
      if (cajaAbierta) {
        await tx.cajaMovimiento.create({
          data: { cajaId: cajaAbierta.id, tipo: "EGRESO", concepto: `Gasto recurrente: ${g.concepto}`, monto: g.valor, gastoId: g.id },
        });
      }
      await tx.gasto.update({
        where: { id: g.id },
        data: { proximaGeneracion: calcularProximaGeneracion(g.periodicidad) },
      });
    });
    generados++;
  }

  await registrarMovimiento("GASTOS", "GENERAR_RECURRENTES", `${generados} gasto(s) recurrente(s) generados`, req.usuario?.usuario || "admin");

  res.json({ ok: true, generados, total: pendientes.length });
});

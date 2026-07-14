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
    const data = { concepto, descripcion, categoria: categoria || "otros", valor: Number(valor) };
    if (recurrente) {
      data.recurrente = true;
      data.periodicidad = periodicidad || "mensual";
      data.proximaGeneracion = calcularProximaGeneracion(periodicidad || "mensual");
    }
    const g = await tx.gasto.create({ data });
    const cajaAbierta = await prisma.caja.findFirst({ where: { estado: "ABIERTA" } });
    if (cajaAbierta) {
      await tx.cajaMovimiento.create({
        data: { cajaId: cajaAbierta.id, tipo: "EGRESO", concepto: `Gasto: ${g.concepto}`, monto: Number(valor), gastoId: g.id },
      });
    }
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
  const existe = await prisma.gasto.findUnique({ where: { id: Number(id) } });
  if (!existe) throw new AppError("Gasto no encontrado", 404);
  const { concepto, descripcion, categoria, valor, recurrente, periodicidad } = req.body;
  const data = {};
  if (concepto) data.concepto = concepto;
  if (descripcion !== undefined) data.descripcion = descripcion;
  if (categoria) data.categoria = categoria;
  if (valor !== undefined) data.valor = Number(valor);
  if (recurrente !== undefined) data.recurrente = recurrente;
  if (periodicidad !== undefined) data.periodicidad = periodicidad;
  if (recurrente && periodicidad) {
    data.proximaGeneracion = calcularProximaGeneracion(periodicidad);
  }
  const gasto = await prisma.gasto.update({ where: { id: Number(id) }, data });

  const movimientoData = {};
  if (concepto) movimientoData.concepto = `Gasto: ${gasto.concepto}`;
  if (valor !== undefined) movimientoData.monto = Number(valor);
  if (Object.keys(movimientoData).length) {
    await prisma.cajaMovimiento.updateMany({
      where: { gastoId: Number(id), tipo: "EGRESO" },
      data: movimientoData,
    });
  }

  await registrarMovimiento("GASTOS", "ACTUALIZAR", `Gasto #${id}: ${gasto.concepto} - $${gasto.valor}`, req.usuario?.usuario || "admin");
  emitirEvento("gasto:actualizado", { mensaje: `Gasto #${id} actualizado`, gasto });
  res.json({ ok: true, gasto });
});

export const eliminarGasto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const gasto = await prisma.gasto.findUnique({ where: { id: Number(id) } });
  if (!gasto) throw new AppError("Gasto no encontrado", 404);
  await prisma.$transaction(async (tx) => {
    await tx.cajaMovimiento.deleteMany({ where: { gastoId: Number(id), tipo: "EGRESO" } });
    await tx.gasto.delete({ where: { id: Number(id) } });
  });
  await registrarMovimiento("GASTOS", "ELIMINAR", `Gasto #${id}: ${gasto.concepto} - $${gasto.valor}`, req.usuario?.usuario || "admin");
  emitirEvento("gasto:eliminado", { mensaje: `Gasto #${id} eliminado: ${gasto.concepto}`, gasto });
  res.json({ ok: true, message: "Gasto eliminado" });
});

export const generarRecurrentes = asyncHandler(async (req, res) => {
  const ahora = new Date();
  const pendientes = await prisma.gasto.findMany({
    where: { recurrente: true, proximaGeneracion: { lte: ahora } },
  });

  let generados = 0;
  for (const g of pendientes) {
    await prisma.$transaction(async (tx) => {
      await tx.gasto.create({
        data: {
          concepto: g.concepto,
          descripcion: g.descripcion,
          categoria: g.categoria,
          valor: g.valor,
          fecha: ahora,
        },
      });
      const cajaAbierta = await tx.caja.findFirst({ where: { estado: "ABIERTA" } });
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

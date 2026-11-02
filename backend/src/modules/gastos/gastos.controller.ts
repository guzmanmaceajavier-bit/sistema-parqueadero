import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { emitirEvento } from "../../services/socket.js";
import { getCajaOError } from "../../helpers/caja.js";
import { calcularProximaGeneracion } from "./gastos.utils.js";
import { resolverSucursalPermitida } from "../../utils/sucursalAccess.js";

export const crearGasto = asyncHandler(async (req, res) => {
  const { concepto, descripcion, categoria, valor, recurrente, periodicidad } = req.body;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.body.sucursalId);
  if (!concepto) throw new AppError("Concepto es requerido", 400);

  await getCajaOError(sucursalId);

  const [gasto] = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124019)) AS advisory_lock`;
    const cajaAbierta = await tx.caja.findFirst({ where: { estado: "ABIERTA", sucursalId: sucursalId ?? null } });
    if (!cajaAbierta) throw new AppError("La caja se cerró antes de registrar el gasto", 409);
    const data: any = { concepto, descripcion, categoria: categoria || "otros", valor: Number(valor), sucursalId: sucursalId ?? null };
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
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const where: any = sucursalId ? { sucursalId } : {};
  if (q) {
    where.OR = [
      { concepto: { contains: q, mode: "insensitive" } },
      { descripcion: { contains: q, mode: "insensitive" } },
      { categoria: { contains: q, mode: "insensitive" } },
    ];
  }
  if (fechaInicio || fechaFin) {
    where.fecha = {};
    if (fechaInicio) where.fecha.gte = new Date(String(fechaInicio));
    if (fechaFin) where.fecha.lte = new Date(String(fechaFin) + "T23:59:59.999Z");
  }
  const { data: gastos, pagination } = await paginate(prisma, "gasto", {
    page, limit, where, orderBy: { id: "desc" },
  });
  res.json({ ok: true, gastos, pagination });
});

export const obtenerGasto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const gasto = await prisma.gasto.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) } });
  if (!gasto) throw new AppError("Gasto no encontrado", 404);
  res.json({ ok: true, gasto });
});

export const actualizarGasto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
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
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124019)) AS advisory_lock`;
    const existe = await tx.gasto.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) } });
    if (!existe) throw new AppError("Gasto no encontrado", 404);

    const recurrenciaFinal = recurrente !== undefined ? recurrente : existe.recurrente;
    const periodicidadFinal = periodicidad !== undefined ? periodicidad : existe.periodicidad;
    if (recurrenciaFinal) {
      if (!periodicidadFinal) throw new AppError("Selecciona una periodicidad para el gasto recurrente", 400);
      data.recurrente = true;
      data.periodicidad = periodicidadFinal;
      if (recurrente === true || periodicidad !== undefined) {
        data.proximaGeneracion = calcularProximaGeneracion(periodicidadFinal);
      }
    } else if (recurrente === false) {
      data.recurrente = false;
      data.proximaGeneracion = null;
    }

    if (Object.keys(data).length === 0) throw new AppError("No hay cambios válidos para guardar", 400);
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
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const gasto = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124019)) AS advisory_lock`;
    const existente = await tx.gasto.findFirst({ where: { id: Number(id), ...(sucursalId ? { sucursalId } : {}) } });
    if (!existente) throw new AppError("Gasto no encontrado", 404);
    const movimientos = await tx.cajaMovimiento.findMany({
      where: { gastoId: Number(id) },
      include: { caja: true },
    });
    if (movimientos.some(m => !m.anulado && m.caja?.estado === "CERRADA")) {
      throw new AppError("No se puede eliminar un gasto que participó en una caja cerrada. El registro financiero debe conservarse.", 409);
    }

    if (movimientos.length > 0) {
      await tx.cajaMovimiento.updateMany({
        where: { gastoId: Number(id) },
        data: {
          anulado: true,
          anuladoEn: new Date(),
          anuladoPor: req.usuario?.usuario || "usuario",
          motivoAnulacion: "Gasto eliminado desde el módulo de gastos",
          gastoId: null,
          concepto: `Gasto anulado: ${existente.concepto}`,
        },
      });
    }
    await tx.gasto.delete({ where: { id: Number(id) } });
    return existente;
  });
  await registrarMovimiento("GASTOS", "ELIMINAR", `Gasto #${id} eliminado y movimiento(s) de caja anulados: ${gasto.concepto} - $${gasto.valor}`, req.usuario?.usuario || "admin");
  emitirEvento("gasto:eliminado", { mensaje: `Gasto #${id} eliminado: ${gasto.concepto}`, gasto });
  res.json({ ok: true, message: "Gasto eliminado; sus movimientos se conservaron como anulados para auditoría" });
});

export const generarRecurrentes = asyncHandler(async (req, res) => {
  const ahora = new Date();
  const sucursalId = resolverSucursalPermitida(req.usuario, req.query.sucursalId);
  const pendientes = await prisma.gasto.findMany({
    where: { recurrente: true, proximaGeneracion: { lte: ahora }, ...(sucursalId ? { sucursalId } : {}) },
    orderBy: { proximaGeneracion: "asc" },
    select: { id: true },
  });

  let generados = 0;
  let omitidos = 0;
  for (const pendiente of pendientes) {
    const generado = await prisma.$transaction(async (tx) => {
      // Comparte el bloqueo de caja con cobros, gastos y cierres.
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124019)) AS advisory_lock`;
      // Releer después del lock evita que dos solicitudes generen el mismo período.
      const plantilla = await tx.gasto.findFirst({ where: { id: pendiente.id, ...(sucursalId ? { sucursalId } : {}) } });
      if (!plantilla || !plantilla.recurrente || !plantilla.proximaGeneracion || plantilla.proximaGeneracion > ahora) {
        return false;
      }
      // En una ejecución administrativa global, cada ocurrencia se carga a la caja
      // de su propia sucursal y nunca a la primera caja abierta que devuelva la BD.
      const cajaAbierta = await tx.caja.findFirst({
        where: { estado: "ABIERTA", sucursalId: plantilla.sucursalId },
      });
      if (!cajaAbierta) return false;

      const siguienteFecha = calcularProximaGeneracion(plantilla.periodicidad, plantilla.proximaGeneracion);
      const reclamado = await tx.gasto.updateMany({
        where: {
          id: plantilla.id,
          recurrente: true,
          proximaGeneracion: plantilla.proximaGeneracion,
        },
        data: { proximaGeneracion: siguienteFecha },
      });
      if (reclamado.count !== 1) return false;

      // Cada ocurrencia es un gasto independiente; el movimiento apunta a ese gasto,
      // no a la plantilla recurrente.
      const ocurrencia = await tx.gasto.create({
        data: {
          concepto: plantilla.concepto,
          descripcion: plantilla.descripcion,
          categoria: plantilla.categoria,
          valor: plantilla.valor,
          fecha: ahora,
          recurrente: false,
          sucursalId: plantilla.sucursalId,
        },
      });
      await tx.cajaMovimiento.create({
        data: {
          cajaId: cajaAbierta.id,
          tipo: "EGRESO",
          concepto: `Gasto recurrente: ${plantilla.concepto}`,
          monto: plantilla.valor,
          gastoId: ocurrencia.id,
        },
      });
      return true;
    });
    if (generado) generados++;
    else omitidos++;
  }

  if (generados > 0) {
    await registrarMovimiento("GASTOS", "GENERAR_RECURRENTES", `${generados} gasto(s) recurrente(s) generados`, req.usuario?.usuario || "admin");
  }

  res.json({
    ok: true,
    generados,
    omitidos,
    totalPendientes: pendientes.length,
    message: omitidos > 0 ? "Algunos gastos se omitieron porque ya fueron procesados o no hay caja abierta." : "Generación completada.",
  });
});

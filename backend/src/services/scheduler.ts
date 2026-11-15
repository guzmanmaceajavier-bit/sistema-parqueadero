import cron from "node-cron";
import prisma from "../config/prisma.js";
import { registrarMovimiento } from "../helpers/movimientos.js";
import { emitirEvento } from "./socket.js";
import { calcularProximaGeneracion } from "../modules/gastos/gastos.utils.js";

async function liberarReservas() {
  const ahora = new Date();
  const candidatas = await prisma.reserva.findMany({
    where: { estado: { in: ["PENDIENTE", "CONFIRMADA"] }, fechaInicio: { lt: ahora } },
    include: { cliente: true },
  });

  let liberadas = 0;
  for (const reserva of candidatas) {
    const limiteLlegada = reserva.fechaFin ?? new Date(reserva.fechaInicio.getTime() + 60 * 60 * 1000);
    if (limiteLlegada > ahora) continue;

    const cambio = await prisma.$transaction(async (tx) => {
      if (reserva.vehiculoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${reserva.vehiculoId}::integer)) AS advisory_lock`;
      if (reserva.puestoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${reserva.puestoId}::integer)) AS advisory_lock`;
      const actualizado = await tx.reserva.updateMany({
        where: { id: reserva.id, estado: { in: ["PENDIENTE", "CONFIRMADA"] } },
        data: { estado: reserva.estado === "CONFIRMADA" ? "NO_SHOW" : "CANCELADA" },
      });
      if (actualizado.count !== 1) return false;
      if (reserva.puestoId) {
        const [ingresoActivo, mensualidadVigente, reservaVigente] = await Promise.all([
          tx.ingreso.count({ where: { puestoId: reserva.puestoId, estado: "ACTIVO" } }),
          tx.mensualidad.count({ where: { puestoId: reserva.puestoId, estado: "ACTIVA", fechaFin: { gte: ahora } } }),
          tx.reserva.count({ where: { puestoId: reserva.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            id: { not: reserva.id }, OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] } }),
        ]);
        const estadoPuesto = ingresoActivo > 0 ? "OCUPADO" : mensualidadVigente + reservaVigente > 0 ? "RESERVADO" : "LIBRE";
        await tx.puesto.update({ where: { id: reserva.puestoId }, data: { estado: estadoPuesto } });
      }
      return true;
    });
    if (!cambio) continue;
    await registrarMovimiento("RESERVAS", "VENCER", `Reserva #${reserva.id} vencida — ${reserva.cliente?.nombres}`, "sistema");
    emitirEvento("reserva:vencida", { mensaje: `Reserva #${reserva.id} vencida — ${reserva.cliente?.nombres}`, reserva });
    liberadas++;
  }

  if (liberadas > 0) console.log(`[Scheduler] ${liberadas} reserva(s) vencida(s) liberada(s)`);
}

/**
 * D10 — marca como RESERVADO los puestos de las reservas que entran en la
 * ventana operativa, y los libera cuando la ventana pasa sin activarse.
 */
async function actualizarReservasPorVentana() {
  const ahora = new Date();
  const config = await prisma.configuracion.findFirst({ select: { reservaVentanaHoras: true } });
  const ventanaHoras = Math.max(0, config?.reservaVentanaHoras ?? 24);

  const candidatas = await prisma.reserva.findMany({
    where: { estado: { in: ["PENDIENTE", "CONFIRMADA"] }, puestoId: { not: null } },
    select: { id: true, puestoId: true, fechaInicio: true },
  });

  let actualizados = 0;
  for (const r of candidatas) {
    const limite = new Date(r.fechaInicio.getTime() - ventanaHoras * 3600000);
    if (limite.getTime() > ahora.getTime()) continue;

    const cambio = await prisma.$transaction(async (tx) => {
      const puesto = await tx.puesto.findUnique({ where: { id: r.puestoId! } });
      if (!puesto || puesto.estado === "OCUPADO" || puesto.estado === "MANTENIMIENTO") return false;
      const otroOcupante = await tx.ingreso.count({ where: { puestoId: r.puestoId!, estado: "ACTIVO" } });
      if (otroOcupante > 0) return false;
      const actualizado = await tx.puesto.updateMany({
        where: { id: r.puestoId!, estado: { notIn: ["OCUPADO", "MANTENIMIENTO"] } },
        data: { estado: "RESERVADO" },
      });
      return actualizado.count === 1;
    });
    if (cambio) actualizados++;
  }

  if (actualizados > 0) console.log(`[Scheduler] ${actualizados} puesto(s) marcado(s) RESERVADO por ventana de reserva`);
}

/**
 * Genera los gastos recurrentes vencidos (sin duplicar) y los registra en caja.
 */
async function generarGastosRecurrentes() {
  const ahora = new Date();
  const pendientes = await prisma.gasto.findMany({
    where: { recurrente: true, proximaGeneracion: { lte: ahora } },
  });
  if (pendientes.length === 0) return;

  let generados = 0;
  for (const plantilla of pendientes) {
    const creado = await prisma.$transaction(async (tx) => {
      // Claim optimista: solo una ejecución puede tomar la plantilla.
      const reclamado = await tx.gasto.updateMany({
        where: { id: plantilla.id, recurrente: true, proximaGeneracion: plantilla.proximaGeneracion },
        data: { proximaGeneracion: calcularProximaGeneracion(plantilla.periodicidad) },
      });
      if (reclamado.count !== 1) return false;

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

      const cajaAbierta = await tx.caja.findFirst({ where: { estado: "ABIERTA", sucursalId: plantilla.sucursalId ?? null } });
      if (cajaAbierta) {
        await tx.cajaMovimiento.create({
          data: {
            cajaId: cajaAbierta.id,
            tipo: "EGRESO",
            concepto: `Gasto recurrente: ${plantilla.concepto}`,
            monto: plantilla.valor,
            gastoId: ocurrencia.id,
          },
        });
      }
      return true;
    });
    if (creado) generados++;
  }

  if (generados > 0) {
    console.log(`[Scheduler] ${generados} gasto(s) recurrente(s) generado(s)`);
    await registrarMovimiento("GASTOS", "GENERAR_RECURRENTES", `${generados} gasto(s) recurrente(s) generado(s)`, "sistema");
  }
}

async function enviarRecordatorios() {  const ahora = new Date();
  const dentroDe2Horas = new Date(ahora.getTime() + 2 * 60 * 60 * 1000);
  const dentroDe1Hora = new Date(ahora.getTime() + 1 * 60 * 60 * 1000);

  const proximas = await prisma.reserva.findMany({
    where: {
      estado: { in: ["PENDIENTE", "CONFIRMADA"] },
      fechaInicio: { gte: dentroDe1Hora, lte: dentroDe2Horas },
    },
    include: { cliente: true, puesto: true, vehiculo: true },
  });

  for (const r of proximas) {
    const tiempoRestante = Math.round((r.fechaInicio.getTime() - ahora.getTime()) / 60000);
    emitirEvento("reserva:recordatorio", {
      mensaje: `Recordatorio: Reserva #${r.id} de ${r.cliente?.nombres} en ${tiempoRestante}min — Puesto ${r.puesto?.codigo || "sin asignar"}`,
      reserva: r,
      minutos: tiempoRestante,
    });
  }

  if (proximas.length > 0) {
    console.log(`[Scheduler] ${proximas.length} recordatorio(s) enviado(s)`);
  }
}

export async function vencerMensualidades() {
  const ahora = new Date();
  const vencidas = await prisma.mensualidad.findMany({
    where: { estado: "ACTIVA", fechaFin: { lt: ahora } },
    select: { id: true, vehiculoId: true, puestoId: true, cliente: { select: { nombres: true } } },
  });

  let procesadas = 0;
  for (const mensualidad of vencidas) {
    const cambio = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${mensualidad.vehiculoId}::integer)) AS advisory_lock`;
      if (mensualidad.puestoId) await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${mensualidad.puestoId}::integer)) AS advisory_lock`;
      const actualizada = await tx.mensualidad.updateMany({
        where: { id: mensualidad.id, estado: "ACTIVA", fechaFin: { lt: ahora } },
        data: { estado: "VENCIDA" },
      });
      if (actualizada.count !== 1) return false;
      if (mensualidad.puestoId) {
        // El puesto NUNCA se libera si el vehículo sigue físicamente dentro:
        // el ingreso activo manda sobre el vencimiento de la cobertura.
        const ingresoActivo = await tx.ingreso.count({ where: { puestoId: mensualidad.puestoId, estado: "ACTIVO" } });
        if (ingresoActivo > 0) {
          await tx.puesto.update({ where: { id: mensualidad.puestoId }, data: { estado: "OCUPADO" } });
        } else {
          const [otraMensualidad, otraReserva] = await Promise.all([
            tx.mensualidad.count({ where: { puestoId: mensualidad.puestoId, estado: "ACTIVA", fechaFin: { gte: ahora } } }),
            tx.reserva.count({ where: { puestoId: mensualidad.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
              OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] } }),
          ]);
          const estadoPuesto = otraMensualidad + otraReserva > 0 ? "RESERVADO" : "LIBRE";
          await tx.puesto.update({ where: { id: mensualidad.puestoId }, data: { estado: estadoPuesto } });
        }
      }
      return true;
    });
    if (!cambio) continue;
    await registrarMovimiento("MENSUALIDADES", "VENCER", `Mensualidad #${mensualidad.id} vencida — ${mensualidad.cliente?.nombres || ""}`, "sistema");
    procesadas++;
  }

  if (procesadas > 0) console.log(`[Scheduler] ${procesadas} mensualidad(es) vencida(s)`);
}

export function iniciarScheduler() {
  cron.schedule("*/10 * * * *", () => {
    liberarReservas().catch((e) => console.error("[Scheduler] Error liberando reservas:", e.message));
    enviarRecordatorios().catch((e) => console.error("[Scheduler] Error enviando recordatorios:", e.message));
    vencerMensualidades().catch((e) => console.error("[Scheduler] Error venciendo mensualidades:", e.message));
    actualizarReservasPorVentana().catch((e) => console.error("[Scheduler] Error aplicando ventana de reservas:", e.message));
  });

  // Los gastos recurrentes se generan a diario (a la 00:05).
  cron.schedule("5 0 * * *", () => {
    generarGastosRecurrentes().catch((e) => console.error("[Scheduler] Error generando gastos recurrentes:", e.message));
  });

  console.log("[Scheduler] Iniciado — cada 10 minutos (gastos recurrentes: diario 00:05)");
}

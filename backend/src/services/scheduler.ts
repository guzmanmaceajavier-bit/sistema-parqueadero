import cron from "node-cron";
import prisma from "../config/prisma.js";
import { registrarMovimiento } from "../helpers/movimientos.js";
import { emitirEvento } from "./socket.js";

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

async function enviarRecordatorios() {
  const ahora = new Date();
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
        const [ingresoActivo, otraMensualidad, otraReserva] = await Promise.all([
          tx.ingreso.count({ where: { puestoId: mensualidad.puestoId, estado: "ACTIVO" } }),
          tx.mensualidad.count({ where: { puestoId: mensualidad.puestoId, estado: "ACTIVA", fechaFin: { gte: ahora } } }),
          tx.reserva.count({ where: { puestoId: mensualidad.puestoId, estado: { in: ["PENDIENTE", "CONFIRMADA", "ACTIVA"] },
            OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }] } }),
        ]);
        const estadoPuesto = ingresoActivo > 0 ? "OCUPADO" : otraMensualidad + otraReserva > 0 ? "RESERVADO" : "LIBRE";
        await tx.puesto.update({ where: { id: mensualidad.puestoId }, data: { estado: estadoPuesto } });
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
  });
  console.log("[Scheduler] Iniciado — cada 10 minutos");
}

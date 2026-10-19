import cron from "node-cron";
import prisma from "../config/prisma.js";
import { registrarMovimiento } from "../helpers/movimientos.js";
import { emitirEvento } from "./socket.js";

async function liberarReservas() {
  const ahora = new Date();
  const vencidas = await prisma.reserva.findMany({
    where: { estado: { in: ["PENDIENTE", "CONFIRMADA"] }, fechaInicio: { lt: ahora } },
    include: { cliente: true, puesto: true, vehiculo: true },
  });

  for (const r of vencidas) {
    const nuevoEstado = r.estado === "CONFIRMADA" ? "NO_SHOW" : "CANCELADA";
    await prisma.reserva.update({ where: { id: r.id }, data: { estado: nuevoEstado } });
    if (r.puestoId) {
      await prisma.puesto.update({ where: { id: r.puestoId }, data: { estado: "LIBRE" } });
    }
    await registrarMovimiento("RESERVAS", "VENCER", `Reserva #${r.id} vencida — ${r.cliente?.nombres}`, "sistema");
    emitirEvento("reserva:vencida", { mensaje: `Reserva #${r.id} vencida — ${r.cliente?.nombres}`, reserva: r });
  }

  if (vencidas.length > 0) {
    console.log(`[Scheduler] ${vencidas.length} reserva(s) vencida(s) liberada(s)`);
  }
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
    select: { id: true, puestoId: true, cliente: { select: { nombres: true } } },
  });

  for (const m of vencidas) {
    await prisma.$transaction(async (tx) => {
      await tx.mensualidad.update({ where: { id: m.id }, data: { estado: "VENCIDA" } });
      // Libera el puesto fijo solo si no hay un ingreso activo en él.
      if (m.puestoId) {
        const ocupado = await tx.ingreso.findFirst({ where: { puestoId: m.puestoId, estado: "ACTIVO" } });
        if (!ocupado) await tx.puesto.update({ where: { id: m.puestoId }, data: { estado: "LIBRE" } });
      }
    });
    await registrarMovimiento("MENSUALIDADES", "VENCER", `Mensualidad #${m.id} vencida — ${m.cliente?.nombres || ""}`, "sistema");
  }

  if (vencidas.length > 0) {
    console.log(`[Scheduler] ${vencidas.length} mensualidad(es) vencida(s)`);
  }
}

export function iniciarScheduler() {
  cron.schedule("*/10 * * * *", () => {
    liberarReservas().catch((e) => console.error("[Scheduler] Error liberando reservas:", e.message));
    enviarRecordatorios().catch((e) => console.error("[Scheduler] Error enviando recordatorios:", e.message));
    vencerMensualidades().catch((e) => console.error("[Scheduler] Error venciendo mensualidades:", e.message));
  });
  console.log("[Scheduler] Iniciado — cada 10 minutos");
}

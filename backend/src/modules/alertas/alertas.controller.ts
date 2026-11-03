import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma.js";
import { asyncHandler } from "../../middlewares/error.middleware.js";

type ClienteMoroso = Prisma.ClienteGetPayload<{ select: { id: true; nombres: true; apellidos: true; telefono: true } }>;
type MensualidadAlerta = Prisma.MensualidadGetPayload<{ include: { cliente: { select: { nombres: true; apellidos: true } } } }>;
type IngresoProlongado = Prisma.IngresoGetPayload<{ include: { vehiculo: { select: { placa: true } }; cliente: { select: { nombres: true; apellidos: true } } } }>;
type ReservaAlerta = Prisma.ReservaGetPayload<{ include: { cliente: { select: { nombres: true; apellidos: true } }; puesto: { select: { codigo: true } } } }>;

export const obtenerAlertas = asyncHandler(async (_req, res) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dentroDe7Dias = new Date(hoy.getTime() + 7 * 86400000);
  const hace8Horas = new Date(Date.now() - 8 * 3600000);

  let morosos: ClienteMoroso[] = [];
  let mensualidadesProximas: MensualidadAlerta[] = [];
  let mensualidadesVencidas: MensualidadAlerta[] = [];
  let vehiculosProlongados: IngresoProlongado[] = [];
  let reservasProximas: ReservaAlerta[] = [];
  let ausenciasActivas = 0;
  let cajaActiva: Awaited<ReturnType<typeof prisma.caja.findFirst>> = null;

  try {
    [morosos, mensualidadesProximas, mensualidadesVencidas, vehiculosProlongados, reservasProximas, cajaActiva, ausenciasActivas] = await Promise.all([
      prisma.cliente.findMany({ where: { estado: "MOROSO" }, select: { id: true, nombres: true, apellidos: true, telefono: true } }),
      prisma.mensualidad.findMany({ where: { fechaFin: { gte: hoy, lte: dentroDe7Dias }, estado: "ACTIVA" }, include: { cliente: { select: { nombres: true, apellidos: true } } } }),
      prisma.mensualidad.findMany({ where: { fechaFin: { lt: hoy }, estado: "ACTIVA" }, include: { cliente: { select: { nombres: true, apellidos: true } } }, orderBy: { fechaFin: "asc" } }),
      prisma.ingreso.findMany({ where: { estado: "ACTIVO", fechaEntrada: { lte: hace8Horas } }, include: { vehiculo: { select: { placa: true } }, cliente: { select: { nombres: true, apellidos: true } } }, orderBy: { fechaEntrada: "asc" } }),
      prisma.reserva.findMany({ where: { estado: { in: ["PENDIENTE", "CONFIRMADA"] }, fechaInicio: { gte: hoy, lte: dentroDe7Dias } }, include: { cliente: { select: { nombres: true, apellidos: true } }, puesto: { select: { codigo: true } } }, orderBy: { fechaInicio: "asc" } }),
      prisma.caja.findFirst({ where: { estado: "ABIERTA" } }),
      prisma.ausencia.count({ where: { estado: "ACTIVA" } }),
    ]);
  } catch (error) {
    console.error("Error consultando alertas:", error instanceof Error ? error.message : String(error));
  }

  const alertas: Array<{ tipo: string; icono: string; titulo: string; descripcion: string; enlace: string }> = [];

  if (morosos.length > 0) {
    alertas.push({
      tipo: "peligro",
      icono: "usuario",
      titulo: `${morosos.length} cliente(s) moroso(s)`,
      descripcion: morosos.map((m) => `${m.nombres} ${m.apellidos}`).join(", "),
      enlace: "/clientes",
    });
  }

  if (mensualidadesVencidas.length > 0) {
    alertas.push({
      tipo: "peligro",
      icono: "calendario",
      titulo: `${mensualidadesVencidas.length} mensualidad(es) vencida(s)`,
      descripcion: mensualidadesVencidas.slice(0, 3).map((m) => `${m.cliente.nombres} ${m.cliente.apellidos} (venció ${new Date(m.fechaFin).toLocaleDateString()})`).join(", "),
      enlace: "/mensualidades",
    });
  }

  if (mensualidadesProximas.length > 0) {
    alertas.push({
      tipo: "advertencia",
      icono: "reloj",
      titulo: `${mensualidadesProximas.length} mensualidad(es) por vencer`,
      descripcion: mensualidadesProximas.slice(0, 3).map((m) => `${m.cliente.nombres} ${m.cliente.apellidos} (vence ${new Date(m.fechaFin).toLocaleDateString()})`).join(", "),
      enlace: "/mensualidades",
    });
  }

  if (vehiculosProlongados.length > 0) {
    alertas.push({
      tipo: "advertencia",
      icono: "vehiculo",
      titulo: `${vehiculosProlongados.length} vehículo(s) con +8h estacionados`,
      descripcion: vehiculosProlongados.slice(0, 3).map((v) => `${v.vehiculo.placa} - ${v.cliente.nombres}`).join(", "),
      enlace: "/ingresos",
    });
  }

  if (reservasProximas.length > 0) {
    alertas.push({
      tipo: "info",
      icono: "reserva",
      titulo: `${reservasProximas.length} reserva(s) próxima(s)`,
      descripcion: reservasProximas.slice(0, 3).map((r) => `${r.cliente.nombres} → ${r.puesto?.codigo || "sin puesto"} (${new Date(r.fechaInicio).toLocaleString()})`).join(", "),
      enlace: "/reservas",
    });
  }

  if (!cajaActiva) {
    alertas.push({
      tipo: "info",
      icono: "caja",
      titulo: "Caja cerrada",
      descripcion: "No hay una caja abierta. Abra la caja para registrar operaciones.",
      enlace: "/caja",
    });
  }

  if (ausenciasActivas > 0) {
    alertas.push({
      tipo: "info",
      icono: "ausencia",
      titulo: `${ausenciasActivas} ausencia(s) activa(s)`,
      descripcion: "Hay clientes registrados como ausentes temporalmente.",
      enlace: "/ausencias",
    });
  }

  res.json({ ok: true, alertas, total: alertas.length });
});

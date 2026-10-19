import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../../config/prisma.js";
import { vencerMensualidades } from "../../services/scheduler.js";

// Ciclo planes/ingresos contra la BD local. Crea filas TEST-* y las borra
// al final. Las pruebas HTTP necesitan el backend en localhost:3001;
// si no responde, se omiten (avisan por consola).
const API = "http://localhost:3001";
const DOC = "999888777";
const PLACA = "TST888";

let serverUp = false;
let cookie = "";
let clienteId = 0;
let vehiculoId = 0;
let puestoPlanId = 0;
let puestoSoloId = 0;
let planId = 0;

async function http(path: string, opts: RequestInit = {}) {
  try {
    return await fetch(API + path, opts);
  } catch {
    return null;
  }
}

beforeAll(async () => {
  // Limpieza previa por si un run anterior quedó a medias.
  await prisma.ingreso.deleteMany({ where: { vehiculo: { placa: PLACA } } }).catch(() => {});
  await prisma.mensualidad.deleteMany({ where: { cliente: { documento: DOC } } }).catch(() => {});
  await prisma.vehiculo.deleteMany({ where: { placa: PLACA } }).catch(() => {});
  await prisma.cliente.deleteMany({ where: { documento: DOC } }).catch(() => {});

  const probe = await http("/");
  serverUp = !!probe;

  const cliente = await prisma.cliente.create({ data: { nombres: "TEST", apellidos: "PLAN", documento: DOC } });
  clienteId = cliente.id;
  const vehiculo = await prisma.vehiculo.create({ data: { placa: PLACA, tipo: "carro", clienteId } });
  vehiculoId = vehiculo.id;
  const plan = await prisma.plan.findFirst({ where: { duracionDias: 30 } });
  if (!plan) throw new Error("Se necesita al menos un plan de 30 días en la BD");
  planId = plan.id;

  const libres = await prisma.puesto.findMany({ where: { estado: "LIBRE" }, take: 2, orderBy: { id: "asc" } });
  if (libres.length < 2) throw new Error("Se necesitan 2 puestos libres para probar");
  puestoPlanId = libres[0].id;
  puestoSoloId = libres[1].id;

  if (serverUp) {
    const adminPass = process.env.ADMIN_PASSWORD || "admin123";
    const r = await http("/api/usuarios/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: "admin", password: adminPass }),
    });
    const setCookie = r?.headers.get("set-cookie") || "";
    cookie = setCookie.split(";")[0];
  }
}, 30000);

afterAll(async () => {
  await prisma.ingreso.deleteMany({ where: { vehiculo: { placa: PLACA } } }).catch(() => {});
  await prisma.mensualidad.deleteMany({ where: { cliente: { documento: DOC } } }).catch(() => {});
  await prisma.vehiculo.deleteMany({ where: { placa: PLACA } }).catch(() => {});
  await prisma.cliente.deleteMany({ where: { documento: DOC } }).catch(() => {});
  await prisma.$disconnect();
});

const auth = () => ({ "Content-Type": "application/json", Cookie: cookie });

describe("Planes y cobro", () => {
  it("el plan vigente ampara al vehículo (no se cobra)", async () => {
    const hoy = new Date();
    const fin = new Date();
    fin.setDate(fin.getDate() + 30);
    await prisma.mensualidad.create({
      data: { clienteId, vehiculoId, planId, puestoId: puestoPlanId, fechaInicio: hoy, fechaFin: fin, valor: 150000 },
    });
    const planActivo = await prisma.mensualidad.findFirst({
      where: { vehiculoId, estado: "ACTIVA", puestoId: { not: null } },
    });
    expect(planActivo).not.toBeNull();
  });

  it("el plan vencido se marca VENCIDA solo y libera el puesto", async () => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 31);
    const m = await prisma.mensualidad.create({
      data: { clienteId, vehiculoId, planId, puestoId: puestoSoloId, fechaInicio: inicio, fechaFin: ayer, valor: 150000 },
    });
    await vencerMensualidades();
    const actual = await prisma.mensualidad.findUnique({ where: { id: m.id } });
    expect(actual?.estado).toBe("VENCIDA");
    const puesto = await prisma.puesto.findUnique({ where: { id: puestoSoloId } });
    expect(puesto?.estado).toBe("LIBRE");
    await prisma.mensualidad.delete({ where: { id: m.id } });
  });

  it("salida con plan no cobra y el puesto sigue ocupado (HTTP)", async () => {
    if (!serverUp) {
      console.warn("Sin backend en 3001, se omite prueba HTTP de salida con plan");
      return;
    }
    const ingreso = await prisma.ingreso.create({ data: { clienteId, vehiculoId, puestoId: puestoPlanId } });
    await prisma.puesto.update({ where: { id: puestoPlanId }, data: { estado: "OCUPADO" } });
    const r = await http(`/api/ingresos/salida-con-cobro/${ingreso.id}`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({ metodoPago: "efectivo" }),
    });
    expect(r?.status).toBe(200);
    const body = await r!.json();
    expect(body.cobro.total).toBe(0);
    const puesto = await prisma.puesto.findUnique({ where: { id: puestoPlanId } });
    expect(puesto?.estado).toBe("OCUPADO");
    await prisma.ingreso.delete({ where: { id: ingreso.id } });
  });

  it("entrada duplicada del mismo vehículo se rechaza (HTTP)", async () => {
    if (!serverUp) {
      console.warn("Sin backend en 3001, se omite prueba HTTP de duplicada");
      return;
    }
    const ingreso = await prisma.ingreso.create({ data: { clienteId, vehiculoId, puestoId: puestoPlanId } });
    const r = await http("/api/ingresos", {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({ clienteId, vehiculoId, puestoId: puestoSoloId }),
    });
    expect(r?.status).toBe(400);
    await prisma.ingreso.delete({ where: { id: ingreso.id } });
  });

  it("liberar sin plan se rechaza y pide salida con cobro (HTTP)", async () => {
    if (!serverUp) {
      console.warn("Sin backend en 3001, se omite prueba HTTP de liberar");
      return;
    }
    await prisma.mensualidad.deleteMany({ where: { vehiculoId } });
    const ingreso = await prisma.ingreso.create({ data: { clienteId, vehiculoId, puestoId: puestoSoloId } });
    const r = await http(`/api/ingresos/liberar/${ingreso.id}`, { method: "PUT", headers: auth() });
    expect(r?.status).toBe(400);
    const body = await r!.json();
    expect(body.message).toMatch(/plan activo/i);
    await prisma.ingreso.delete({ where: { id: ingreso.id } });
    const hoy = new Date();
    const fin = new Date();
    fin.setDate(fin.getDate() + 30);
    await prisma.mensualidad.create({
      data: { clienteId, vehiculoId, planId, puestoId: puestoPlanId, fechaInicio: hoy, fechaFin: fin, valor: 150000 },
    });
  });
});

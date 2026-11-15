import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "../../config/prisma.js";

const API = "http://localhost:3001";
const SUFIJO = `backup-${process.pid}-${Date.now()}`;
let cookie = "";
let clienteId = 0;
let facturaId = 0;
let movimientoId = 0;

async function request(path: string, options: RequestInit = {}) {
  return fetch(API + path, options);
}

beforeAll(async () => {
  const login = await request("/api/usuarios/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usuario: "admin",
      password: process.env.ADMIN_PASSWORD || "admin123",
    }),
  });
  if (!login.ok) throw new Error(`No se pudo autenticar el usuario de prueba: HTTP ${login.status}`);
  cookie = (login.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie) throw new Error("El inicio de sesión no devolvió la cookie de autenticación");

  const cliente = await prisma.cliente.create({
    data: {
      nombres: "Backup",
      apellidos: "Integración",
      documento: `DOC-${SUFIJO}`,
    },
  });
  clienteId = cliente.id;

  const factura = await prisma.factura.create({
    data: {
      numero: `BK-${Date.now()}-${process.pid}`,
      origen: "INGRESO",
      valor: 123.45,
      metodoPago: "efectivo",
    },
  });
  facturaId = factura.id;

  const movimiento = await prisma.clienteSaldoMovimiento.create({
    data: {
      clienteId,
      facturaId,
      tipo: "CONSUMO",
      monto: 12.34,
      saldoAntes: 50,
      saldoDespues: 37.66,
      concepto: `Consumo de prueba ${SUFIJO}`,
      usuario: "admin",
    },
  });
  movimientoId = movimiento.id;
}, 30000);

afterAll(async () => {
  if (movimientoId) await prisma.clienteSaldoMovimiento.deleteMany({ where: { id: movimientoId } }).catch(() => {});
  if (facturaId) await prisma.factura.deleteMany({ where: { id: facturaId } }).catch(() => {});
  if (clienteId) await prisma.cliente.deleteMany({ where: { id: clienteId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("Respaldo y restauración PostgreSQL", () => {
  it("conserva el vínculo exacto entre un movimiento de saldo y su factura", async () => {
    const exportacion = await request("/api/backup", {
      headers: { Cookie: cookie },
    });
    expect(exportacion.status).toBe(200);
    const cuerpo = await exportacion.json() as { backup?: { data?: Record<string, any[]> } };
    const datos = cuerpo.backup?.data;
    expect(datos).toBeDefined();

    const movimientoExportado = datos!.clienteSaldoMovimientos.find((m) => m.id === movimientoId);
    expect(movimientoExportado?.facturaId).toBe(facturaId);
    expect(datos!.facturas.some((f) => f.id === facturaId)).toBe(true);

    // Simula la pérdida de la fila del libro auxiliar antes de restaurar el respaldo.
    await prisma.clienteSaldoMovimiento.delete({ where: { id: movimientoId } });

    const restauracion = await request("/api/backup/restaurar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ data: datos }),
    });
    expect(restauracion.status, await restauracion.clone().text()).toBe(200);

    const restaurado = await prisma.clienteSaldoMovimiento.findUnique({
      where: { id: movimientoId },
    });
    expect(restaurado?.facturaId).toBe(facturaId);
    expect(restaurado?.monto).toBe(12.34);
  }, 30000);
});

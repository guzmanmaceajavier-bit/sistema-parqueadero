import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  factura: { findMany: vi.fn(), groupBy: vi.fn() },
  gasto: { findMany: vi.fn() },
  ingreso: { findMany: vi.fn() },
  puesto: { groupBy: vi.fn() },
  configuracion: { findFirst: vi.fn() },
}));

vi.mock("../../config/prisma.js", () => ({ default: prismaMock }));

import { obtenerReporte } from "../../modules/reportes/reportes.controller.js";

describe("obtenerReporte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.factura.findMany.mockResolvedValue([]);
    prismaMock.factura.groupBy.mockResolvedValue([]);
    prismaMock.gasto.findMany.mockResolvedValue([]);
    prismaMock.ingreso.findMany.mockResolvedValue([]);
    prismaMock.puesto.groupBy.mockResolvedValue([]);
    prismaMock.configuracion.findFirst.mockResolvedValue({ zonaHoraria: "UTC" });
  });

  it("aplica fechas y sucursal, y separa facturas pendientes de ingresos cobrados", async () => {
    prismaMock.factura.findMany.mockResolvedValue([
      { id: 1, numero: "PEND-1", valor: 100, metodoPago: null, createdAt: new Date("2026-10-02T10:00:00.000Z"), ingreso: null, mensualidad: null },
      { id: 2, numero: "PAG-1", valor: 250, metodoPago: "efectivo", createdAt: new Date("2026-10-03T10:00:00.000Z"), ingreso: null, mensualidad: null },
    ]);
    const resultado = await new Promise((resolve, reject) => {
      const req = { query: { fechaInicio: "2026-10-01", fechaFin: "2026-10-31", sucursalId: "7" } };
      const res = { json: vi.fn(resolve) };
      obtenerReporte(req as any, res as any, reject as any);
    });

    expect(resultado).toMatchObject({
      ok: true,
      resumen: { ingresos: 250, gastos: 0, utilidad: 250, facturas: 2, puestos: { total: 0, libres: 0 } },
      facturas: [
        { id: 1, estadoPago: "PENDIENTE", metodoPago: null },
        { id: 2, estadoPago: "PAGADA", metodoPago: "efectivo" },
      ],
      ingresosPorDia: expect.arrayContaining([
        expect.objectContaining({ fecha: "2026-10-02", ingresos: 0 }),
        expect.objectContaining({ fecha: "2026-10-03", ingresos: 250 }),
      ]),
    });

    const rango = {
      gte: new Date("2026-10-01T00:00:00.000Z"),
      lt: new Date("2026-11-01T00:00:00.000Z"),
    };
    expect(prismaMock.factura.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdAt: rango, sucursalId: 7 },
      include: expect.objectContaining({
        ingreso: expect.any(Object),
        mensualidad: expect.objectContaining({
          cliente: { select: { nombres: true, apellidos: true } },
          vehiculo: { select: { placa: true, tipo: true } },
        }),
      }),
    }));
    expect(prismaMock.gasto.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { fecha: rango, sucursalId: 7 },
    }));
    expect(prismaMock.puesto.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { activo: true, sucursalId: 7 },
    }));
    expect(prismaMock.ingreso.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { fechaEntrada: rango, puesto: { sucursalId: 7 } },
      select: { fechaEntrada: true },
    }));
    expect(prismaMock.factura.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdAt: rango, metodoPago: { not: null }, sucursalId: 7 },
    }));
  });

  it("rechaza sucursales inválidas antes de consultar la base de datos", async () => {
    const error = await new Promise((resolve) => {
      const req = { query: { sucursalId: "no-es-un-id" } };
      const res = { json: vi.fn() };
      obtenerReporte(req as any, res as any, resolve as any);
    });

    expect(error).toMatchObject({ statusCode: 400, message: "La sucursal seleccionada no es válida" });
    expect(prismaMock.factura.findMany).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  factura: { findMany: vi.fn(), groupBy: vi.fn() },
  gasto: { findMany: vi.fn() },
  ingreso: { findMany: vi.fn() },
  puesto: { groupBy: vi.fn() },
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
  });

  it("aplica fechas, sucursal y pago confirmado a todos los totales del reporte", async () => {
    const resultado = await new Promise((resolve, reject) => {
      const req = { query: { fechaInicio: "2026-10-01", fechaFin: "2026-10-31", sucursalId: "7" } };
      const res = { json: vi.fn(resolve) };
      obtenerReporte(req as any, res as any, reject as any);
    });

    expect(resultado).toMatchObject({
      ok: true,
      resumen: { ingresos: 0, gastos: 0, utilidad: 0, puestos: { total: 0, libres: 0 } },
    });

    const rango = {
      gte: new Date("2026-10-01T00:00:00.000Z"),
      lt: new Date("2026-11-01T00:00:00.000Z"),
    };
    expect(prismaMock.factura.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdAt: rango, metodoPago: { not: null }, sucursalId: 7 },
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

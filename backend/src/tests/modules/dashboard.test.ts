import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  puesto: { groupBy: vi.fn() },
  ingreso: { count: vi.fn(), findMany: vi.fn() },
  factura: { aggregate: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
  gasto: { aggregate: vi.fn(), findMany: vi.fn() },
  mensualidad: { groupBy: vi.fn(), count: vi.fn() },
  cliente: { groupBy: vi.fn() },
  vehiculo: { count: vi.fn(), groupBy: vi.fn() },
  movimiento: { findMany: vi.fn() },
  ausencia: { count: vi.fn() },
  caja: { findFirst: vi.fn() },
  reserva: { groupBy: vi.fn() },
  configuracion: { findFirst: vi.fn() },
  $queryRawUnsafe: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({ default: prismaMock }));

import { obtenerDashboard } from "../../modules/dashboard/dashboard.controller.js";

describe("obtenerDashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T15:00:00.000Z"));
    vi.clearAllMocks();
    prismaMock.puesto.groupBy.mockResolvedValue([]);
    prismaMock.ingreso.count.mockResolvedValue(0);
    prismaMock.ingreso.findMany.mockResolvedValue([]);
    prismaMock.factura.aggregate.mockResolvedValue({ _sum: { valor: 0 } });
    prismaMock.factura.findMany.mockResolvedValue([]);
    prismaMock.factura.groupBy.mockResolvedValue([]);
    prismaMock.gasto.aggregate.mockResolvedValue({ _sum: { valor: 0 } });
    prismaMock.gasto.findMany.mockResolvedValue([]);
    prismaMock.mensualidad.groupBy.mockResolvedValue([]);
    prismaMock.mensualidad.count.mockResolvedValue(0);
    prismaMock.cliente.groupBy.mockResolvedValue([]);
    prismaMock.vehiculo.count.mockResolvedValue(0);
    prismaMock.vehiculo.groupBy.mockResolvedValue([]);
    prismaMock.movimiento.findMany.mockResolvedValue([]);
    prismaMock.ausencia.count.mockResolvedValue(0);
    prismaMock.caja.findFirst.mockResolvedValue(null);
    prismaMock.reserva.groupBy.mockResolvedValue([]);
    prismaMock.configuracion.findFirst.mockResolvedValue({ zonaHoraria: "UTC" });
    prismaMock.$queryRawUnsafe.mockResolvedValue([]);
  });

  afterEach(() => vi.useRealTimers());

  async function consultar(filtro: string) {
    return new Promise((resolve, reject) => {
      const req = { usuario: { id: 1, rol: "admin" }, query: { filtro } };
      const res = { json: vi.fn(resolve) };
      obtenerDashboard(req as any, res as any, reject as any);
    });
  }

  it.each(["hoy", "semana", "mes"])("mantiene los KPIs semanal y mensual correctos con filtro %s", async (filtro) => {
    await consultar(filtro);

    expect(prismaMock.ingreso.count).toHaveBeenNthCalledWith(2, {
      where: { fechaEntrada: { gte: new Date("2026-10-15T00:00:00.000Z"), lt: new Date("2026-10-16T00:00:00.000Z") } },
    });
    expect(prismaMock.factura.aggregate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        metodoPago: { not: null },
        createdAt: { gte: new Date("2026-10-01T00:00:00.000Z"), lt: new Date("2026-10-16T00:00:00.000Z") },
      },
    }));
    expect(prismaMock.factura.aggregate).toHaveBeenNthCalledWith(3, expect.objectContaining({
      where: {
        metodoPago: { not: null },
        createdAt: { gte: new Date("2026-10-11T00:00:00.000Z"), lt: new Date("2026-10-16T00:00:00.000Z") },
      },
    }));
  });

  it("rechaza una sucursal inválida antes de consultar los indicadores", async () => {
    const error = await new Promise((resolve) => {
      const req = { usuario: { id: 1, rol: "admin" }, query: { filtro: "hoy", sucursalId: "0" } };
      const res = { json: vi.fn() };
      obtenerDashboard(req as any, res as any, resolve as any);
    });
    expect(error).toMatchObject({ statusCode: 400, message: "La sucursal seleccionada no es válida" });
    expect(prismaMock.factura.aggregate).not.toHaveBeenCalled();
  });

  it("rechaza períodos y sucursales inválidos sin consultar los indicadores", async () => {
    const error = await new Promise((resolve) => {
      const req = { usuario: { id: 1, rol: "admin" }, query: { filtro: "trimestre", sucursalId: "0" } };
      const res = { json: vi.fn() };
      obtenerDashboard(req as any, res as any, resolve as any);
    });
    expect(error).toMatchObject({ statusCode: 400, message: "El período del dashboard no es válido" });
    expect(prismaMock.factura.aggregate).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from "vitest";
import { calcularTotalesHelper } from "../../modules/caja/caja.helpers.js";

import { afterEach, beforeEach } from "vitest";

const { findReservaFirst } = vi.hoisted(() => ({
  findReservaFirst: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  default: {
    reserva: { findFirst: findReservaFirst },
  },
}));

import { buscarReservaActiva } from "../../modules/ingresos/ingresos.service.js";

describe("Caja helpers", () => {
  it("excludes annulled movements and separates cash expenses", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { monto: 50000, tipo: "INGRESO", metodoPago: "efectivo" },
      { monto: 20000, tipo: "INGRESO", metodoPago: "tarjeta" },
      { monto: 5000, tipo: "EGRESO", metodoPago: "efectivo" },
      { monto: 9000, tipo: "EGRESO", metodoPago: "transferencia" },
    ]);
    const db = { cajaMovimiento: { findMany } } as any;

    const totals = await calcularTotalesHelper(7, db);

    expect(findMany).toHaveBeenCalledWith({
      where: { cajaId: 7, anulado: false },
      select: { monto: true, tipo: true, metodoPago: true },
    });
    expect(totals.ingresos).toBe(70000);
    expect(totals.egresos).toBe(14000);
    expect(totals.ingresosEfectivo).toBe(50000);
    expect(totals.egresosEfectivo).toBe(5000);
  });
});

describe("Reserva vinculada al ingreso", () => {
  const ahora = new Date("2026-11-02T15:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(ahora);
    findReservaFirst.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("busca por cliente y vehículo exactos y exige vigencia", async () => {
    const reserva = { id: 21, clienteId: 7, vehiculoId: 11, puestoId: 4 };
    findReservaFirst.mockResolvedValue(reserva);

    await expect(buscarReservaActiva(7, 11)).resolves.toBe(reserva);
    expect(findReservaFirst).toHaveBeenCalledWith({
      where: {
        clienteId: 7,
        vehiculoId: 11,
        estado: { in: ["PENDIENTE", "CONFIRMADA"] },
        fechaInicio: { lte: ahora },
        OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }],
      },
      include: { puesto: true },
      orderBy: { fechaInicio: "asc" },
    });
  });

  it("no reutiliza reservas de otro vehículo", async () => {
    findReservaFirst.mockResolvedValue(null);
    await expect(buscarReservaActiva(7, 12)).resolves.toBeNull();
    expect(findReservaFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ clienteId: 7, vehiculoId: 12 }),
    }));
  });
});

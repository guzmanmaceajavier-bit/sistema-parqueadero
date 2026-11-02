import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  default: {
    reserva: { findFirst },
  },
}));

import { buscarReservaActiva } from "../../modules/ingresos/ingresos.service.js";

describe("buscarReservaActiva", () => {
  const ahora = new Date("2026-11-02T15:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(ahora);
    findFirst.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("busca la reserva del cliente y vehículo exactos dentro de su vigencia", async () => {
    const reserva = { id: 21, clienteId: 7, vehiculoId: 11, puestoId: 4 };
    findFirst.mockResolvedValue(reserva);

    const resultado = await buscarReservaActiva(7, 11);

    expect(resultado).toBe(reserva);
    expect(findFirst).toHaveBeenCalledWith({
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

  it("devuelve null cuando no hay una reserva vigente para ese vehículo", async () => {
    findFirst.mockResolvedValue(null);

    await expect(buscarReservaActiva(7, 12)).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ clienteId: 7, vehiculoId: 12 }),
    }));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  reserva: { findFirst: vi.fn() },
}));

vi.mock("../../config/prisma.js", () => ({ default: prismaMock }));

import { buscarReservaActiva } from "../../modules/ingresos/ingresos.service.js";

describe("buscarReservaActiva", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("busca una reserva vigente por cliente y vehículo, no solo por cliente", async () => {
    prismaMock.reserva.findFirst.mockResolvedValue({ id: 31, clienteId: 4, vehiculoId: 12 });

    const reserva = await buscarReservaActiva(4, 12);

    expect(reserva?.id).toBe(31);
    expect(prismaMock.reserva.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        clienteId: 4,
        vehiculoId: 12,
        estado: { in: ["PENDIENTE", "CONFIRMADA"] },
        fechaInicio: { lte: expect.any(Date) },
        OR: [{ fechaFin: null }, { fechaFin: { gte: expect.any(Date) } }],
      }),
      include: { puesto: true },
      orderBy: { fechaInicio: "asc" },
    });
  });

  it("devuelve null cuando el vehículo no tiene reserva vigente", async () => {
    prismaMock.reserva.findFirst.mockResolvedValue(null);

    await expect(buscarReservaActiva(4, 99)).resolves.toBeNull();
    expect(prismaMock.reserva.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clienteId: 4, vehiculoId: 99 }),
      }),
    );
  });
});

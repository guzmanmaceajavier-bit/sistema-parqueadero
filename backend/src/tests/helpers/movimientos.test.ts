import { beforeEach, describe, expect, it, vi } from "vitest";

const { usuarioFindUnique, movimientoCreate } = vi.hoisted(() => ({
  usuarioFindUnique: vi.fn(),
  movimientoCreate: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  default: {
    usuario: { findUnique: usuarioFindUnique },
    movimiento: { create: movimientoCreate },
  },
}));

import { registrarMovimiento } from "../../helpers/movimientos.js";

describe("registrarMovimiento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usuarioFindUnique.mockResolvedValue({ id: 12, sucursalId: 7 });
    movimientoCreate.mockResolvedValue({ id: 1 });
  });

  it("vincula el registro al usuario y a su sucursal asignada", async () => {
    await registrarMovimiento("CAJA", "ABRIR", "Caja abierta", "supervisor");
    expect(usuarioFindUnique).toHaveBeenCalledWith({
      where: { usuario: "supervisor" },
      select: { id: true, sucursalId: true },
    });
    expect(movimientoCreate).toHaveBeenCalledWith({
      data: {
        modulo: "CAJA",
        accion: "ABRIR",
        descripcion: "Caja abierta",
        usuario: "supervisor",
        usuarioId: 12,
        sucursalId: 7,
      },
    });
  });

  it("conserva el actor al registrar una acción de sucursal explícita", async () => {
    await registrarMovimiento("FACTURACION", "CREAR", "Factura emitida", "admin", 3);
    expect(usuarioFindUnique).toHaveBeenCalledWith({
      where: { usuario: "admin" },
      select: { id: true, sucursalId: true },
    });
    expect(movimientoCreate).toHaveBeenCalledWith({
      data: {
        modulo: "FACTURACION",
        accion: "CREAR",
        descripcion: "Factura emitida",
        usuario: "admin",
        usuarioId: 12,
        sucursalId: 3,
      },
    });
  });

  it("deja los eventos del sistema sin actor ni sucursal", async () => {
    usuarioFindUnique.mockResolvedValue(null);
    await registrarMovimiento("RESERVAS", "VENCER", "Reserva vencida", "sistema");
    expect(movimientoCreate).toHaveBeenCalledWith({
      data: {
        modulo: "RESERVAS",
        accion: "VENCER",
        descripcion: "Reserva vencida",
        usuario: "sistema",
        usuarioId: null,
        sucursalId: null,
      },
    });
  });
});

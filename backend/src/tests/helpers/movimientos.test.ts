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
    usuarioFindUnique.mockResolvedValue({ sucursalId: 7 });
    movimientoCreate.mockResolvedValue({ id: 1 });
  });

  it("atribuye el registro a la sucursal asignada al actor", async () => {
    await registrarMovimiento("CAJA", "ABRIR", "Caja abierta", "supervisor");
    expect(usuarioFindUnique).toHaveBeenCalledWith({
      where: { usuario: "supervisor" },
      select: { sucursalId: true },
    });
    expect(movimientoCreate).toHaveBeenCalledWith({
      data: {
        modulo: "CAJA",
        accion: "ABRIR",
        descripcion: "Caja abierta",
        usuario: "supervisor",
        sucursalId: 7,
      },
    });
  });

  it("respeta una sucursal explícita para acciones administrativas", async () => {
    await registrarMovimiento("FACTURACION", "CREAR", "Factura emitida", "admin", 3);
    expect(usuarioFindUnique).not.toHaveBeenCalled();
    expect(movimientoCreate).toHaveBeenCalledWith({
      data: {
        modulo: "FACTURACION",
        accion: "CREAR",
        descripcion: "Factura emitida",
        usuario: "admin",
        sucursalId: 3,
      },
    });
  });

  it("deja los eventos del sistema sin sucursal cuando no hay actor", async () => {
    usuarioFindUnique.mockResolvedValue(null);
    await registrarMovimiento("RESERVAS", "VENCER", "Reserva vencida", "sistema");
    expect(movimientoCreate).toHaveBeenCalledWith({
      data: {
        modulo: "RESERVAS",
        accion: "VENCER",
        descripcion: "Reserva vencida",
        usuario: "sistema",
        sucursalId: null,
      },
    });
  });
});

import { describe, it, expect, vi } from "vitest";
import { calcularTotalesHelper } from "../../modules/caja/caja.helpers.js";

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

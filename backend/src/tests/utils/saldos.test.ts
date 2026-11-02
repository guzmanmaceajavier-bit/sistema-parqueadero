import { describe, expect, it } from "vitest";
import { calcularPagadoMensualidad } from "../../utils/saldos.js";

describe("calcularPagadoMensualidad", () => {
  const inicio = new Date("2026-05-01T00:00:00.000Z");

  it("no cuenta facturas automáticas sin método de pago como dinero recibido", () => {
    const total = calcularPagadoMensualidad([
      { createdAt: new Date("2026-05-02T10:00:00.000Z"), valor: 100000, metodoPago: null },
    ], inicio);
    expect(total).toBe(0);
  });

  it("suma únicamente pagos del periodo vigente", () => {
    const total = calcularPagadoMensualidad([
      { createdAt: new Date("2026-04-30T23:59:59.000Z"), valor: 25000, metodoPago: "efectivo" },
      { createdAt: new Date("2026-05-02T10:00:00.000Z"), valor: 30000, metodoPago: "efectivo" },
      { createdAt: new Date("2026-05-03T10:00:00.000Z"), valor: 20000, metodoPago: "transferencia" },
      { createdAt: new Date("2026-05-04T10:00:00.000Z"), valor: 50000, metodoPago: null },
    ], inicio);
    expect(total).toBe(50000);
  });

  it("rechaza una fecha de inicio inválida", () => {
    expect(() => calcularPagadoMensualidad([], new Date("invalid"))).toThrow(RangeError);
  });
});

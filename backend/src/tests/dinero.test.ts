import { describe, expect, it } from "vitest";
import { aCentavos, desdeCentavos, normalizarMonto, redondearDinero, restarDinero, sumarDinero } from "../utils/dinero.js";

describe("utilidades monetarias", () => {
  it("normaliza importes a dos decimales", () => {
    expect(normalizarMonto("1250.456")).toBe(1250.46);
    expect(normalizarMonto(1250.4)).toBe(1250.4);
    expect(redondearDinero(0.1 + 0.2)).toBe(0.3);
  });

  it("rechaza entradas vacías, no numéricas e infinitas", () => {
    for (const valor of ["", "   ", "abc", "Infinity", Infinity, -Infinity, NaN, null, undefined, true]) {
      expect(normalizarMonto(valor)).toBeNull();
    }
  });

  it("rechaza importes que exceden el rango seguro de centavos", () => {
    expect(normalizarMonto(Number.MAX_SAFE_INTEGER)).toBeNull();
    expect(() => aCentavos(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
    expect(() => desdeCentavos(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it("suma y resta en centavos sin acumular errores binarios", () => {
    expect(sumarDinero(0.1, 0.2, 0.3)).toBe(0.6);
    expect(restarDinero(10, 0.1 + 0.2)).toBe(9.7);
  });
});

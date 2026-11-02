import { describe, expect, it } from "vitest";
import { sumarMesesConTope } from "../../utils/fechas.js";

describe("sumarMesesConTope", () => {
  it("ajusta el 31 de enero al último día de febrero en año no bisiesto", () => {
    const result = sumarMesesConTope(new Date("2025-01-31T10:30:00.000Z"), 1);
    expect(result.toISOString()).toBe("2025-02-28T10:30:00.000Z");
  });

  it("conserva el 29 de febrero cuando el siguiente mes tiene ese día", () => {
    const result = sumarMesesConTope(new Date("2024-01-31T10:30:00.000Z"), 1);
    expect(result.toISOString()).toBe("2024-02-29T10:30:00.000Z");
  });

  it("ajusta los meses de 30 días sin desbordarse al mes siguiente", () => {
    const result = sumarMesesConTope(new Date("2026-08-31T08:00:00.000Z"), 1);
    expect(result.toISOString()).toBe("2026-09-30T08:00:00.000Z");
  });

  it("mantiene la hora y los minutos originales", () => {
    const result = sumarMesesConTope(new Date("2026-03-15T18:45:12.000Z"), 1);
    expect(result.toISOString()).toBe("2026-04-15T18:45:12.000Z");
  });

  it("rechaza fechas inválidas y cantidades fraccionarias de meses", () => {
    expect(() => sumarMesesConTope(new Date("invalid"), 1)).toThrow(RangeError);
    expect(() => sumarMesesConTope(new Date(), 1.5)).toThrow(RangeError);
  });
});

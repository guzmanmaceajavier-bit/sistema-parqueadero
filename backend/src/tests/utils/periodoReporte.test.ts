import { describe, expect, it } from "vitest";
import { obtenerPeriodoReporte } from "../../utils/periodoReporte.js";

describe("obtenerPeriodoReporte", () => {
  it("incluye todo el último día mediante un límite exclusivo", () => {
    const { inicio, finExclusivo } = obtenerPeriodoReporte("2026-10-01", "2026-10-31");
    expect(inicio.toISOString()).toBe("2026-10-01T05:00:00.000Z");
    expect(finExclusivo.toISOString()).toBe("2026-11-01T05:00:00.000Z");
  });

  it("respeta zonas horarias configuradas distintas a Bogotá", () => {
    const { inicio, finExclusivo } = obtenerPeriodoReporte(
      "2026-10-01",
      "2026-10-01",
      new Date("2026-10-01T12:00:00.000Z"),
      "UTC",
    );
    expect(inicio.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(finExclusivo.toISOString()).toBe("2026-10-02T00:00:00.000Z");
  });

  it("calcula correctamente el inicio del día en zonas al este de UTC", () => {
    const { inicio, finExclusivo } = obtenerPeriodoReporte(
      "2026-01-15",
      "2026-01-15",
      new Date("2026-01-15T12:00:00.000Z"),
      "Europe/Berlin",
    );
    expect(inicio.toISOString()).toBe("2026-01-14T23:00:00.000Z");
    expect(finExclusivo.toISOString()).toBe("2026-01-15T23:00:00.000Z");
  });

  it("rechaza fechas inexistentes y formatos ambiguos", () => {
    expect(() => obtenerPeriodoReporte("2026-02-30", "2026-03-01")).toThrow(RangeError);
    expect(() => obtenerPeriodoReporte("01/10/2026", "2026-10-02")).toThrow(RangeError);
  });

  it("rechaza intervalos invertidos", () => {
    expect(() => obtenerPeriodoReporte("2026-10-03", "2026-10-02")).toThrow(
      "La fecha inicial no puede ser posterior a la fecha final",
    );
  });

  it("usa el día actual cuando no se especifican fechas", () => {
    const ahora = new Date("2026-11-02T15:30:00.000Z");
    const { inicio, finExclusivo } = obtenerPeriodoReporte(undefined, undefined, ahora);
    expect(inicio.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(finExclusivo.toISOString()).toBe("2026-11-03T05:00:00.000Z");
  });
});

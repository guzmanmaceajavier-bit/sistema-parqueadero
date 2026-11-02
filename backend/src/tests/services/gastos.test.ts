import { describe, expect, it } from "vitest";
import { calcularProximaGeneracion } from "../../modules/gastos/gastos.utils.js";

describe("calcularProximaGeneracion", () => {
  it("avanza una semana desde la fecha programada", () => {
    const inicio = new Date(2026, 0, 5, 12);
    const resultado = calcularProximaGeneracion("semanal", inicio);
    expect(resultado.getFullYear()).toBe(2026);
    expect(resultado.getMonth()).toBe(0);
    expect(resultado.getDate()).toBe(12);
  });

  it("ajusta al último día del mes cuando el mes siguiente es más corto", () => {
    const inicio = new Date(2026, 0, 31, 12);
    const resultado = calcularProximaGeneracion("mensual", inicio);
    expect(resultado.getFullYear()).toBe(2026);
    expect(resultado.getMonth()).toBe(1);
    expect(resultado.getDate()).toBe(28);
  });

  it("ajusta un aniversario de año bisiesto al 28 de febrero", () => {
    const inicio = new Date(2024, 1, 29, 12);
    const resultado = calcularProximaGeneracion("anual", inicio);
    expect(resultado.getFullYear()).toBe(2025);
    expect(resultado.getMonth()).toBe(1);
    expect(resultado.getDate()).toBe(28);
  });

  it("rechaza periodicidades no soportadas", () => {
    expect(() => calcularProximaGeneracion("diaria", new Date())).toThrow(/Periodicidad no válida/);
  });
});

import { describe, expect, it } from "vitest";
import { abrirCajaSchema, cerrarCajaSchema } from "../../schemas/caja.schema.js";
import { crearGastoSchema, actualizarGastoSchema } from "../../schemas/gasto.schema.js";

describe("schemas de caja", () => {
  it("acepta apertura no negativa y contraseña", () => {
    expect(abrirCajaSchema.safeParse({ apertura: 50000, password: "clave-segura" }).success).toBe(true);
  });

  it("rechaza importes de apertura infinitos o negativos", () => {
    expect(abrirCajaSchema.safeParse({ apertura: -1, password: "clave" }).success).toBe(false);
    expect(abrirCajaSchema.safeParse({ apertura: "Infinity", password: "clave" }).success).toBe(false);
  });

  it("rechaza conteos con fracciones o cantidades negativas", () => {
    expect(cerrarCajaSchema.safeParse({ conteo: { billetes: { "50000": 1.5 } } }).success).toBe(false);
    expect(cerrarCajaSchema.safeParse({ conteo: { monedas: { "500": -1 } } }).success).toBe(false);
  });

  it("acepta conteo entero no negativo", () => {
    expect(cerrarCajaSchema.safeParse({ conteo: { billetes: { "50000": 2 }, monedas: { "500": 4 } } }).success).toBe(true);
  });
});

describe("schemas de gastos", () => {
  it("rechaza valores no finitos y montos no positivos", () => {
    expect(crearGastoSchema.safeParse({ concepto: "Arriendo", valor: "Infinity" }).success).toBe(false);
    expect(crearGastoSchema.safeParse({ concepto: "Arriendo", valor: 0 }).success).toBe(false);
  });

  it("acepta periodicidad permitida y rechaza periodicidad desconocida", () => {
    expect(crearGastoSchema.safeParse({ concepto: "Servicio", valor: 1000, recurrente: true, periodicidad: "mensual" }).success).toBe(true);
    expect(crearGastoSchema.safeParse({ concepto: "Servicio", valor: 1000, recurrente: true, periodicidad: "cada-rato" }).success).toBe(false);
  });

  it("rechaza una actualización vacía", () => {
    expect(actualizarGastoSchema.safeParse({}).success).toBe(false);
  });
});

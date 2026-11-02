import { describe, expect, it } from "vitest";
import { resumirEstadosPuestos } from "../../utils/puestos.js";

describe("resumirEstadosPuestos", () => {
  it("distingue puestos libres de reservados y en mantenimiento", () => {
    expect(resumirEstadosPuestos([
      { estado: "LIBRE", _count: 4 },
      { estado: "OCUPADO", _count: 3 },
      { estado: "RESERVADO", _count: 2 },
      { estado: "MANTENIMIENTO", _count: 1 },
      { estado: "AUSENCIA", _count: 1 },
    ])).toEqual({
      total: 11,
      ocupados: 3,
      libres: 4,
      reservados: 2,
      mantenimiento: 1,
      ausencias: 1,
    });
  });

  it("devuelve ceros cuando no existen puestos", () => {
    expect(resumirEstadosPuestos([])).toEqual({
      total: 0,
      ocupados: 0,
      libres: 0,
      reservados: 0,
      mantenimiento: 0,
      ausencias: 0,
    });
  });
});

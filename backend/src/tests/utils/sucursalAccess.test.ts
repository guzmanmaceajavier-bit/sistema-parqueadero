import { describe, expect, it } from "vitest";
import { resolverSucursalPermitida } from "../../utils/sucursalAccess.js";

describe("resolverSucursalPermitida", () => {
  it("permite al administrador consultar todas las sucursales", () => {
    expect(resolverSucursalPermitida({ rol: "admin", sucursalId: null }, undefined)).toBeUndefined();
  });

  it("permite al administrador seleccionar una sucursal válida", () => {
    expect(resolverSucursalPermitida({ rol: "admin" }, "3")).toBe(3);
  });

  it("fuerza al empleado a consultar solo su sucursal asignada", () => {
    expect(resolverSucursalPermitida({ rol: "empleado", sucursalId: 4 }, undefined)).toBe(4);
    expect(() => resolverSucursalPermitida({ rol: "empleado", sucursalId: 4 }, 5)).toThrow(/otra sucursal/);
  });

  it("deniega acceso global a usuarios no administradores sin sucursal", () => {
    expect(() => resolverSucursalPermitida({ rol: "supervisor", sucursalId: null }, undefined)).toThrow(/no tiene una sucursal/);
  });

  it("rechaza identificadores de sucursal inválidos", () => {
    expect(() => resolverSucursalPermitida({ rol: "admin" }, "0")).toThrow(/no es válida/);
  });
});

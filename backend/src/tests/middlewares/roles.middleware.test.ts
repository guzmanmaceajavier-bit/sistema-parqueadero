import { describe, expect, it, vi } from "vitest";
import { verificarRol } from "../../middlewares/roles.middleware.js";

function ejecutarGuard(usuario: unknown, roles: string[]) {
  const req = { usuario } as any;
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const res = { status, json } as any;
  const next = vi.fn();
  verificarRol(...roles)(req, res, next);
  return { status, json, next };
}

describe("verificarRol", () => {
  it("responde 401 cuando no hay identidad autenticada", () => {
    const result = ejecutarGuard(undefined, ["admin"]);
    expect(result.status).toHaveBeenCalledWith(401);
    expect(result.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    expect(result.next).not.toHaveBeenCalled();
  });

  it("responde 403 cuando el rol no está autorizado", () => {
    const result = ejecutarGuard({ id: 2, rol: "empleado" }, ["admin", "supervisor"]);
    expect(result.status).toHaveBeenCalledWith(403);
    expect(result.next).not.toHaveBeenCalled();
  });

  it("permite continuar cuando el rol está autorizado", () => {
    const result = ejecutarGuard({ id: 1, rol: "supervisor" }, ["admin", "supervisor"]);
    expect(result.next).toHaveBeenCalledOnce();
    expect(result.status).not.toHaveBeenCalled();
  });
});

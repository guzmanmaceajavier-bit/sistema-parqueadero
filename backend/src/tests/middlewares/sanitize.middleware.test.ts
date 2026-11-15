import { describe, expect, it, vi } from "vitest";
import { sanitizeBody } from "../../middlewares/sanitize.middleware.js";

describe("sanitizeBody", () => {
  it("preserva contraseñas y tokens sin alterarlos", () => {
    const req: any = {
      body: {
        password: "  <Clave>&segura  ",
        currentPassword: "p<ass>word",
        token: "abc<123>",
        nombre: "<b>Javier</b>",
      },
      query: {},
    };
    const next = vi.fn();
    sanitizeBody(req, {} as any, next);
    expect(req.body.password).toBe("  <Clave>&segura  ");
    expect(req.body.currentPassword).toBe("p<ass>word");
    expect(req.body.token).toBe("abc<123>");
    expect(req.body.nombre).toBe("Javier");
    expect(next).toHaveBeenCalledOnce();
  });

  it("sanitiza textos dentro de objetos y arreglos", () => {
    const req: any = {
      body: { items: [{ descripcion: "<b>Repuesto</b>" }] },
      query: {},
    };
    sanitizeBody(req, {} as any, vi.fn());
    expect(req.body.items[0].descripcion).toBe("Repuesto");
  });
});

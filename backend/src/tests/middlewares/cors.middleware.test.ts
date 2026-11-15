import { describe, expect, it, vi } from "vitest";
import { corsSeguro } from "../../middlewares/cors.middleware.js";

function ejecutar(origin: string | undefined, method = "GET", env = "production", allow = "https://parqueadero.example") {
  const req: any = { headers: { origin }, method };
  const headers: Record<string, string> = {};
  const res: any = {
    header: vi.fn((key: string, value: string) => { headers[key] = value; return res; }),
    status: vi.fn(() => res),
    json: vi.fn(() => res),
    sendStatus: vi.fn(() => res),
  };
  const next = vi.fn();
  corsSeguro(allow, env)(req, res, next);
  return { req, res, next, headers };
}

describe("corsSeguro", () => {
  it("permite el origen exacto declarado", () => {
    const r = ejecutar("https://parqueadero.example");
    expect(r.next).toHaveBeenCalledOnce();
    expect(r.headers["Access-Control-Allow-Origin"]).toBe("https://parqueadero.example");
    expect(r.headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("rechaza un origen no declarado en lugar de procesar la petición", () => {
    const r = ejecutar("https://malicioso.example", "POST");
    expect(r.res.status).toHaveBeenCalledWith(403);
    expect(r.res.json).toHaveBeenCalledWith({ ok: false, message: "Origen no autorizado" });
    expect(r.next).not.toHaveBeenCalled();
  });

  it("permite clientes sin Origin", () => {
    const r = ejecutar(undefined);
    expect(r.next).toHaveBeenCalledOnce();
  });

  it("responde preflight solo a orígenes autorizados", () => {
    const r = ejecutar("https://parqueadero.example", "OPTIONS");
    expect(r.res.sendStatus).toHaveBeenCalledWith(204);
    expect(r.next).not.toHaveBeenCalled();
  });

  it("permite cualquier origen en desarrollo solo si no hay allowlist", () => {
    const r = ejecutar("http://localhost:5173", "GET", "development", "");
    expect(r.next).toHaveBeenCalledOnce();
  });
});

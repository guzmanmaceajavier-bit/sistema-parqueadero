import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import "../config/prisma.js";

describe("serialización de Prisma.Decimal", () => {
  it("mantiene importes como números JSON para compatibilidad del frontend", () => {
    const payload = JSON.parse(JSON.stringify({
      valor: new Prisma.Decimal("1250.75"),
      saldo: new Prisma.Decimal("0.10"),
    }));
    expect(payload).toEqual({ valor: 1250.75, saldo: 0.1 });
    expect(typeof payload.valor).toBe("number");
    expect(typeof payload.saldo).toBe("number");
  });
});

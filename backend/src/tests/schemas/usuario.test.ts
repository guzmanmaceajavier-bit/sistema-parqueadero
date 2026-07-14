import { describe, it, expect } from "vitest";
import { crearUsuarioSchema } from "../../schemas/usuario.schema.js";

describe("crearUsuarioSchema", () => {
  it("should reject password shorter than 8 chars", () => {
    const result = crearUsuarioSchema.safeParse({
      nombre: "Test",
      usuario: "testuser",
      correo: "test@test.com",
      password: "1234567",
    });
    expect(result.success).toBe(false);
  });

  it("should accept valid data", () => {
    const result = crearUsuarioSchema.safeParse({
      nombre: "Test",
      usuario: "testuser",
      correo: "test@test.com",
      password: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = crearUsuarioSchema.safeParse({
      nombre: "Test",
      usuario: "testuser",
      correo: "not-an-email",
      password: "12345678",
    });
    expect(result.success).toBe(false);
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";

const API_URL = "http://localhost:3001";
let testToken = "";

describe("API Backend", () => {
  it("debe rechazar peticiones sin token en rutas protegidas", async () => {
    const res = await fetch(`${API_URL}/api/clientes`, {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.message).toContain("Token");
  });

  it("debe rechazar token inválido", async () => {
    const res = await fetch(`${API_URL}/api/clientes`, {
      headers: { "Content-Type": "application/json", Authorization: "Bearer token_invalido" },
    });
    expect(res.status).toBe(401);
  });

  it("debe rechazar login sin credenciales", async () => {
    const res = await fetch(`${API_URL}/api/usuarios/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });

  it("debe rechazar login con credenciales incorrectas", async () => {
    const res = await fetch(`${API_URL}/api/usuarios/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: "usuario_inexistente", password: "123456" }),
    });
    expect(res.status).toBe(401);
  });

  it("debe rechazar creación de cliente con datos inválidos", async () => {
    const token = jwt.sign({ id: 1, usuario: "test", rol: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const res = await fetch(`${API_URL}/api/clientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nombres: "", apellidos: "", documento: "" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.errors).toBeDefined();
  });

  it("debe rechazar gasto con valor negativo", async () => {
    const token = jwt.sign({ id: 1, usuario: "test", rol: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const res = await fetch(`${API_URL}/api/gastos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ concepto: "Test", valor: -100 }),
    });
    expect(res.status).toBe(400);
  });

  it("debe rechazar ingreso sin cliente", async () => {
    const token = jwt.sign({ id: 1, usuario: "test", rol: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const res = await fetch(`${API_URL}/api/ingresos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ vehiculoId: 1, puestoId: 1 }),
    });
    expect(res.status).toBe(400);
  });

  it("debe rechazar mensualidad con valor cero", async () => {
    const token = jwt.sign({ id: 1, usuario: "test", rol: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const res = await fetch(`${API_URL}/api/mensualidades`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clienteId: 1, vehiculoId: 1, fechaInicio: "2025-01-01", fechaFin: "2025-02-01", valor: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("debe rechazar plan sin nombre", async () => {
    const token = jwt.sign({ id: 1, usuario: "test", rol: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const res = await fetch(`${API_URL}/api/planes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ duracionDias: 30, valor: 100 }),
    });
    expect(res.status).toBe(400);
  });

  it("debe rechazar GET /api/configuracion sin token (público)", async () => {
    const res = await fetch(`${API_URL}/api/configuracion`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("debe rechazar token con tokenVersion desactualizada", async () => {
    const token = jwt.sign({ id: 1, usuario: "test", rol: "admin", tokenVersion: -1 }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const res = await fetch(`${API_URL}/api/clientes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.message).toContain("Sesi");
  });

  it("debe rechazar refresh-token sin token", async () => {
    const res = await fetch(`${API_URL}/api/usuarios/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("debe rechazar refresh-token con token invalido", async () => {
    const res = await fetch(`${API_URL}/api/usuarios/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token_malisimo" },
    });
    expect(res.status).toBe(401);
  });

  it("debe rechazar acceso a usuarios sin rol admin", async () => {
    const token = jwt.sign({ id: 1, usuario: "empleado1", rol: "empleado" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const res = await fetch(`${API_URL}/api/usuarios`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("debe rechazar cierre de caja sin body", async () => {
    const token = jwt.sign({ id: 1, usuario: "test", rol: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const res = await fetch(`${API_URL}/api/caja/cerrar/1`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("debe rechazar eliminar usuario sin admin", async () => {
    const token = jwt.sign({ id: 1, usuario: "supervisor1", rol: "supervisor" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const res = await fetch(`${API_URL}/api/usuarios/1`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("debe rechazar gasto con categoria invalida", async () => {
    const token = jwt.sign({ id: 1, usuario: "test", rol: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const res = await fetch(`${API_URL}/api/gastos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ concepto: "Test", categoria: "categoria_inexistente", valor: 1000 }),
    });
    expect(res.status).toBe(400);
  });

  it("debe rechazar ingreso con puestoId null (antes requerido)", async () => {
    const token = jwt.sign({ id: 1, usuario: "test", rol: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const res = await fetch(`${API_URL}/api/ingresos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clienteId: 1, vehiculoId: 1 }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("puesto");
  });

  it("debe obtener caja movements endpoint", async () => {
    const token = jwt.sign({ id: 1, usuario: "test", rol: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const res = await fetch(`${API_URL}/api/caja/1/movimientos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.facturas).toBeDefined();
    expect(data.gastos).toBeDefined();
  });
});

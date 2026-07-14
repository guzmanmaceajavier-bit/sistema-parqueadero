import { describe, it, expect } from "vitest";
import { generarTicketPDF } from "../../services/ticket.service.js";

describe("generarTicketPDF", () => {
  it("should generate a PDF buffer", async () => {
    const buffer = await generarTicketPDF({
      titulo: "TICKET DE ENTRADA",
      tipo: "entrada",
      folio: "F-001",
      placa: "ABC123",
      ingreso: new Date().toLocaleString("es-CO"),
      parqueadero: "Test Parking",
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it("should generate a PDF with Total for salida", async () => {
    const buffer = await generarTicketPDF({
      titulo: "FACTURA DE SALIDA",
      tipo: "salida",
      folio: "F-002",
      placa: "XYZ789",
      ingreso: new Date().toLocaleString("es-CO"),
      salida: new Date().toLocaleString("es-CO"),
      tiempo: "2h 30min",
      total: 15000,
      metodoPago: "efectivo",
      parqueadero: "Test Parking",
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });
});

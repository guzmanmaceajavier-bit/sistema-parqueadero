import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  vehiculo: { findFirst: vi.fn() },
  tarifa: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  configuracion: { findFirst: vi.fn() },
}));

vi.mock("../../config/prisma.js", () => ({ default: prismaMock }));

import { calcularCobro } from "../../services/calculadorCobros.js";

const tarifaBase = {
  id: 7,
  nombre: "Tarifa moto",
  tipoVehiculo: "moto",
  modalidad: "hora",
  valor: 5000,
  minutosCortesia: 0,
  minutosGratis: 0,
  precioHoraAdicional: null,
  precioPrimeraHora: null,
  tarifaMaximaDiaria: null,
  activa: true,
  descripcion: null,
  sucursalId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("calcularCobro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.configuracion.findFirst.mockResolvedValue({ minutosGracia: 0 });
    prismaMock.vehiculo.findFirst.mockResolvedValue({ tipo: "moto" });
  });

  it("usa la tarifa asignada al vehículo aunque no se envíe una modalidad", async () => {
    prismaMock.tarifa.findFirst.mockResolvedValue({ ...tarifaBase, modalidad: "diario", valor: 12000 });

    const result = await calcularCobro({
      ingreso: { id: 1, vehiculoId: 10, fechaEntrada: new Date("2026-01-01T08:00:00") },
      tipoVehiculo: "moto",
      tarifaId: 7,
      fechaSalida: new Date("2026-01-01T09:00:00"),
    });

    expect(prismaMock.tarifa.findFirst).toHaveBeenCalledWith({ where: { id: 7, OR: [{ sucursalId: null }, { sucursalId: null }] } });
    expect(prismaMock.tarifa.findUnique).not.toHaveBeenCalled();
    expect(result.total).toBe(12000);
  });

  it("descuenta cortesía, minutos gratis y gracia antes de redondear horas", async () => {
    prismaMock.tarifa.findFirst.mockResolvedValue({
      ...tarifaBase,
      valor: 5000,
      minutosCortesia: 5,
      minutosGratis: 5,
    });
    prismaMock.configuracion.findFirst.mockResolvedValue({ minutosGracia: 5 });

    const result = await calcularCobro({
      ingreso: { id: 2, vehiculoId: 10, fechaEntrada: new Date("2026-01-01T08:00:00") },
      tipoVehiculo: "moto",
      tarifaId: 7,
      fechaSalida: new Date("2026-01-01T08:15:00"),
    });

    expect(result.minutosFacturables).toBe(0);
    expect(result.total).toBe(0);
  });

  it("aplica el redondeo de la tarifa por hora al superar el período gratuito", async () => {
    prismaMock.tarifa.findFirst.mockResolvedValue({ ...tarifaBase, valor: 5000, minutosCortesia: 10 });

    const result = await calcularCobro({
      ingreso: { id: 3, vehiculoId: 10, fechaEntrada: new Date("2026-01-01T08:00:00") },
      tipoVehiculo: "moto",
      tarifaId: 7,
      fechaSalida: new Date("2026-01-01T08:11:00"),
    });

    expect(result.minutosFacturables).toBe(1);
    expect(result.total).toBe(5000);
  });

  it("rechaza una salida anterior a la entrada", async () => {
    const result = await calcularCobro({
      ingreso: { id: 4, vehiculoId: 10, fechaEntrada: new Date("2026-01-01T09:00:00") },
      tipoVehiculo: "moto",
      tarifaId: 7,
      fechaSalida: new Date("2026-01-01T08:59:00"),
    });

    expect(result.error).toContain("anterior");
    expect(prismaMock.tarifa.findFirst).not.toHaveBeenCalled();
  });

  it("normaliza modalidades guardadas en mayúsculas y calcula la unidad correcta", async () => {
    prismaMock.tarifa.findFirst.mockResolvedValue({ ...tarifaBase, modalidad: "DIARIO", valor: 12000 });

    const result = await calcularCobro({
      ingreso: { id: 5, vehiculoId: 10, fechaEntrada: new Date("2026-01-01T08:00:00") },
      tipoVehiculo: "moto",
      tarifaId: 7,
      fechaSalida: new Date("2026-01-02T08:00:00"),
    });

    expect(result.total).toBe(12000);
    expect(result.desglose).toMatchObject({ dias: 1, unidad: "dia" });
  });

  it("calcula tarifa progresiva y respeta el tope diario por bloques de 24 horas", async () => {
    prismaMock.tarifa.findFirst.mockResolvedValue({
      ...tarifaBase,
      modalidad: "HORA",
      precioPrimeraHora: 7000,
      precioHoraAdicional: 3000,
      tarifaMaximaDiaria: 12000,
    });

    const result = await calcularCobro({
      ingreso: { id: 6, vehiculoId: 10, fechaEntrada: new Date("2026-01-01T08:00:00") },
      tipoVehiculo: "moto",
      tarifaId: 7,
      fechaSalida: new Date("2026-01-02T09:00:00"),
    });

    expect(result.totalMinutos).toBe(1500);
    expect(result.desglose).toMatchObject({ horas: 25, unidad: "hora_progresiva" });
    expect(result.total).toBe(24000);
  });

  it("rechaza modalidades desconocidas en lugar de cobrarlas como hora", async () => {
    prismaMock.tarifa.findFirst.mockResolvedValue({ ...tarifaBase, modalidad: "festivo" });

    const result = await calcularCobro({
      ingreso: { id: 7, vehiculoId: 10, fechaEntrada: new Date("2026-01-01T08:00:00") },
      tipoVehiculo: "moto",
      tarifaId: 7,
      fechaSalida: new Date("2026-01-01T09:00:00"),
    });

    expect(result.error).toContain("no está soportada");
    expect(result.total).toBe(0);
  });


  it("rechaza una tarifa progresiva incompleta antes de calcular el importe", async () => {
    prismaMock.tarifa.findFirst.mockResolvedValue({
      ...tarifaBase,
      precioPrimeraHora: 7000,
      precioHoraAdicional: null,
    });

    const result = await calcularCobro({
      ingreso: { id: 8, vehiculoId: 10, fechaEntrada: new Date("2026-01-01T08:00:00") },
      tipoVehiculo: "moto",
      tarifaId: 7,
      fechaSalida: new Date("2026-01-01T09:00:00"),
    });

    expect(result.error).toContain("progresiva está incompleta");
    expect(result.total).toBe(0);
  });


  it("no cobra un ticket extraviado con tarifa normal si falta el máximo diario", async () => {
    prismaMock.tarifa.findFirst.mockResolvedValue({ ...tarifaBase, tarifaMaximaDiaria: null });

    const result = await calcularCobro({
      ingreso: { id: 9, vehiculoId: 10, fechaEntrada: new Date("2026-01-01T08:00:00") },
      tipoVehiculo: "moto",
      tarifaId: 7,
      ticketExtraviado: true,
      fechaSalida: new Date("2026-01-01T09:00:00"),
    });

    expect(result.error).toContain("No hay una tarifa máxima diaria");
    expect(result.total).toBe(0);
  });

  it("aplica el máximo diario configurado cuando se pierde el ticket", async () => {
    prismaMock.tarifa.findFirst.mockResolvedValue({ ...tarifaBase, tarifaMaximaDiaria: 30000 });

    const result = await calcularCobro({
      ingreso: { id: 10, vehiculoId: 10, fechaEntrada: new Date("2026-01-01T08:00:00") },
      tipoVehiculo: "moto",
      tarifaId: 7,
      ticketExtraviado: true,
      fechaSalida: new Date("2026-01-02T08:00:00"),
    });

    expect(result.total).toBe(30000);
    expect(result.ticketExtraviado).toBe(true);
    expect(result.desglose).toMatchObject({ unidad: "tarifa_maxima" });
  });

});

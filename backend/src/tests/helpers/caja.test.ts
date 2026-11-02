import { describe, it, expect, vi } from "vitest";
import { calcularTotalesHelper } from "../../modules/caja/caja.helpers.js";

import { afterEach, beforeEach } from "vitest";

const { findReservaFirst, findTarifaUnique, findConfigFirst } = vi.hoisted(() => ({
  findReservaFirst: vi.fn(),
  findTarifaUnique: vi.fn(),
  findConfigFirst: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  default: {
    reserva: { findFirst: findReservaFirst },
    tarifa: { findUnique: findTarifaUnique },
    configuracion: { findFirst: findConfigFirst },
  },
}));

import { buscarReservaActiva } from "../../modules/ingresos/ingresos.service.js";
import { calcularCobro } from "../../services/calculadorCobros.js";

describe("Caja helpers", () => {
  it("excludes annulled movements and separates cash expenses", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { monto: 50000, tipo: "INGRESO", metodoPago: "efectivo" },
      { monto: 20000, tipo: "INGRESO", metodoPago: "tarjeta" },
      { monto: 5000, tipo: "EGRESO", metodoPago: "efectivo" },
      { monto: 9000, tipo: "EGRESO", metodoPago: "transferencia" },
    ]);
    const db = { cajaMovimiento: { findMany } } as any;

    const totals = await calcularTotalesHelper(7, db);

    expect(findMany).toHaveBeenCalledWith({
      where: { cajaId: 7, anulado: false },
      select: { monto: true, tipo: true, metodoPago: true },
    });
    expect(totals.ingresos).toBe(70000);
    expect(totals.egresos).toBe(14000);
    expect(totals.ingresosEfectivo).toBe(50000);
    expect(totals.egresosEfectivo).toBe(5000);
  });
});

describe("Reserva vinculada al ingreso", () => {
  const ahora = new Date("2026-11-02T15:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(ahora);
    findReservaFirst.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("busca por cliente y vehículo exactos y exige vigencia", async () => {
    const reserva = { id: 21, clienteId: 7, vehiculoId: 11, puestoId: 4 };
    findReservaFirst.mockResolvedValue(reserva);

    await expect(buscarReservaActiva(7, 11)).resolves.toBe(reserva);
    expect(findReservaFirst).toHaveBeenCalledWith({
      where: {
        clienteId: 7,
        vehiculoId: 11,
        estado: { in: ["PENDIENTE", "CONFIRMADA"] },
        fechaInicio: { lte: ahora },
        OR: [{ fechaFin: null }, { fechaFin: { gte: ahora } }],
      },
      include: { puesto: true },
      orderBy: { fechaInicio: "asc" },
    });
  });

  it("no reutiliza reservas de otro vehículo", async () => {
    findReservaFirst.mockResolvedValue(null);
    await expect(buscarReservaActiva(7, 12)).resolves.toBeNull();
    expect(findReservaFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ clienteId: 7, vehiculoId: 12 }),
    }));
  });
});

describe("Cálculo de tarifas por tiempo facturable", () => {
  const tarifaBase = {
    id: 1,
    nombre: "Tarifa de prueba",
    tipoVehiculo: "carro",
    modalidad: "diario",
    valor: 10000,
    activa: true,
    minutosCortesia: 120,
    minutosGratis: 0,
    tarifaMaximaDiaria: null,
    precioPrimeraHora: null,
    precioHoraAdicional: null,
  };

  beforeEach(() => {
    findTarifaUnique.mockReset();
    findConfigFirst.mockReset();
    findConfigFirst.mockResolvedValue({ minutosGracia: 0 });
  });

  async function calcular(modalidad: string, entrada: string, salida: string, cambios: Record<string, unknown> = {}) {
    findTarifaUnique.mockResolvedValue({ ...tarifaBase, modalidad, ...cambios });
    return calcularCobro({
      ingreso: { id: 1, vehiculoId: 2, fechaEntrada: new Date(entrada) },
      tipoVehiculo: "carro",
      fechaSalida: new Date(salida),
      tarifaId: 1,
    });
  }

  it("descuenta cortesía antes de redondear días", async () => {
    const cobro = await calcular("diario", "2026-01-01T08:00:00.000Z", "2026-01-02T09:00:00.000Z");
    expect(cobro.total).toBe(10000);
    expect(cobro.minutosFacturables).toBe(1380);
    expect(cobro.desglose).toMatchObject({ dias: 1 });
  });

  it("descuenta cortesía antes de redondear semanas y quincenas", async () => {
    const semanal = await calcular("semanal", "2026-01-01T08:00:00.000Z", "2026-01-08T09:00:00.000Z", { valor: 50000 });
    expect(semanal.total).toBe(50000);
    expect(semanal.desglose).toMatchObject({ semanas: 1 });

    const quincenal = await calcular("quincenal", "2026-01-01T08:00:00.000Z", "2026-01-16T09:00:00.000Z", { valor: 80000 });
    expect(quincenal.total).toBe(80000);
    expect(quincenal.desglose).toMatchObject({ quincenas: 1 });
  });

  it("aplica cortesía al aniversario de la mensualidad en cambios de mes", async () => {
    const cobro = await calcular("mensual", "2026-01-31T10:00:00.000Z", "2026-02-28T10:30:00.000Z", { valor: 200000, minutosCortesia: 60 });
    expect(cobro.total).toBe(200000);
    expect(cobro.desglose).toMatchObject({ meses: 1 });
  });

  it("respeta el aniversario mensual exacto y redondea el minuto excedente", async () => {
    const exacto = await calcular("mensual", "2026-01-31T10:00:00.000Z", "2026-02-28T10:00:00.000Z", {
      valor: 200000,
      minutosCortesia: 0,
    });
    const excedido = await calcular("mensual", "2026-01-31T10:00:00.000Z", "2026-02-28T10:01:00.000Z", {
      valor: 200000,
      minutosCortesia: 0,
    });
    expect(exacto.desglose).toMatchObject({ meses: 1 });
    expect(exacto.total).toBe(200000);
    expect(excedido.desglose).toMatchObject({ meses: 2 });
    expect(excedido.total).toBe(400000);
  });

  it("maneja el aniversario mensual en año bisiesto", async () => {
    const cobro = await calcular("mensual", "2024-02-29T08:00:00.000Z", "2024-03-29T08:00:00.000Z", {
      valor: 200000,
      minutosCortesia: 0,
    });
    expect(cobro.desglose).toMatchObject({ meses: 1 });
  });

  it("aplica el máximo diario por cada día facturable, también en tarifa horaria normal", async () => {
    const cobro = await calcular("hora", "2026-01-01T08:00:00.000Z", "2026-01-03T08:00:00.000Z", {
      valor: 10000,
      minutosCortesia: 0,
      tarifaMaximaDiaria: 15000,
    });
    expect(cobro.total).toBe(30000);
  });

  it("aplica el máximo diario por cada día facturable en tarifa progresiva", async () => {
    const cobro = await calcular("hora", "2026-01-01T08:00:00.000Z", "2026-01-03T08:00:00.000Z", {
      valor: 10000,
      minutosCortesia: 0,
      tarifaMaximaDiaria: 15000,
      precioPrimeraHora: 10000,
      precioHoraAdicional: 10000,
    });
    expect(cobro.total).toBe(30000);
  });
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import prisma from "../../config/prisma.js";

const suffix = `it-${process.pid}-${Date.now()}`;
let clienteId = 0;
let vehiculoId = 0;
let puestoId = 0;

beforeEach(async () => {
  const cliente = await prisma.cliente.create({
    data: {
      nombres: "Prueba",
      apellidos: "Integracion",
      documento: `DOC-${suffix}`,
    },
  });
  clienteId = cliente.id;

  const vehiculo = await prisma.vehiculo.create({
    data: {
      placa: `PL-${String(process.pid).slice(-3)}${String(Date.now()).slice(-6)}`,
      clienteId,
      tipo: "carro",
    },
  });
  vehiculoId = vehiculo.id;

  const puesto = await prisma.puesto.create({
    data: {
      codigo: `P-${String(process.pid).slice(-3)}${String(Date.now()).slice(-6)}`,
      tipoPuesto: "carro",
      estado: "LIBRE",
    },
  });
  puestoId = puesto.id;
});

afterAll(async () => {
  if (vehiculoId) {
    await prisma.ingreso.deleteMany({ where: { vehiculoId } });
    await prisma.vehiculo.deleteMany({ where: { id: vehiculoId } });
  }
  if (puestoId) await prisma.puesto.deleteMany({ where: { id: puestoId } });
  if (clienteId) await prisma.cliente.deleteMany({ where: { id: clienteId } });
  await prisma.$disconnect();
});

describe("Concurrencia de ingresos y salidas (PostgreSQL real)", () => {
  it("permite una sola entrada simultánea para el mismo vehículo y puesto", async () => {
    const intentarEntrada = () => prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124021, ${vehiculoId})`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124020, ${puestoId})`;

      const existente = await tx.ingreso.findFirst({
        where: { vehiculoId, estado: "ACTIVO" },
        select: { id: true },
      });
      if (existente) return false;

      const puestoActualizado = await tx.puesto.updateMany({
        where: { id: puestoId, activo: true, estado: "LIBRE" },
        data: { estado: "OCUPADO" },
      });
      if (puestoActualizado.count !== 1) return false;

      await tx.ingreso.create({ data: { clienteId, vehiculoId, puestoId } });
      return true;
    });

    const resultados = await Promise.all([intentarEntrada(), intentarEntrada()]);

    expect(resultados.filter(Boolean)).toHaveLength(1);
    expect(await prisma.ingreso.count({ where: { vehiculoId, estado: "ACTIVO" } })).toBe(1);
    expect((await prisma.puesto.findUniqueOrThrow({ where: { id: puestoId } })).estado).toBe("OCUPADO");
  });

  it("permite una sola salida simultánea y finaliza el ingreso una vez", async () => {
    const ingreso = await prisma.ingreso.create({
      data: { clienteId, vehiculoId, puestoId },
    });

    const intentarSalida = () => prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124021, ${vehiculoId})`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124020, ${puestoId})`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124019)`;

      const actualizado = await tx.ingreso.updateMany({
        where: { id: ingreso.id, estado: "ACTIVO" },
        data: { estado: "FINALIZADO", fechaSalida: new Date() },
      });
      return actualizado.count;
    });

    const resultados = await Promise.all([intentarSalida(), intentarSalida()]);

    expect(resultados.reduce((total, count) => total + count, 0)).toBe(1);
    expect(await prisma.ingreso.count({ where: { id: ingreso.id, estado: "FINALIZADO" } })).toBe(1);
  });
});

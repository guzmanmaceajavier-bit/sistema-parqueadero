import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import prisma from "../../config/prisma.js";

let fixtureCounter = 0;
let clienteId = 0;
let vehiculoId = 0;
let vehiculosIds: number[] = [];
let puestoId = 0;

beforeEach(async () => {
  const suffix = `it-${process.pid}-${Date.now()}-${++fixtureCounter}`;
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
      placa: `PL-${suffix}`,
      clienteId,
      tipo: "carro",
    },
  });
  vehiculoId = vehiculo.id;
  vehiculosIds = [vehiculoId];

  const puesto = await prisma.puesto.create({
    data: {
      codigo: `P-${suffix}`,
      tipoPuesto: "carro",
      estado: "LIBRE",
    },
  });
  puestoId = puesto.id;
});

afterEach(async () => {
  if (vehiculoId) {
    await prisma.ingreso.deleteMany({ where: { vehiculoId: { in: vehiculosIds } } });
    await prisma.vehiculo.deleteMany({ where: { id: { in: vehiculosIds } } });
  }
  if (puestoId) await prisma.puesto.deleteMany({ where: { id: puestoId } });
  if (clienteId) await prisma.cliente.deleteMany({ where: { id: clienteId } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Concurrencia de ingresos y salidas (PostgreSQL real)", () => {
  it("permite una sola entrada simultánea para el mismo vehículo y puesto", async () => {
    const segundoVehiculo = await prisma.vehiculo.create({
      data: {
        placa: `PL-SEG-${process.pid}-${fixtureCounter}`,
        clienteId,
        tipo: "carro",
      },
    });
    vehiculosIds.push(segundoVehiculo.id);

    const intentarEntrada = (idVehiculo: number) => prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124021, ${idVehiculo}::integer)`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124020, ${puestoId}::integer)`;

      const existente = await tx.ingreso.findFirst({
        where: { vehiculoId: idVehiculo, estado: "ACTIVO" },
        select: { id: true },
      });
      if (existente) return false;

      const puestoActualizado = await tx.puesto.updateMany({
        where: { id: puestoId, activo: true, estado: "LIBRE" },
        data: { estado: "OCUPADO" },
      });
      if (puestoActualizado.count !== 1) return false;

      await tx.ingreso.create({ data: { clienteId, vehiculoId: idVehiculo, puestoId } });
      return true;
    });

    const resultados = await Promise.all([intentarEntrada(vehiculoId), intentarEntrada(segundoVehiculo.id)]);

    expect(resultados.filter(Boolean)).toHaveLength(1);
    expect(await prisma.ingreso.count({ where: { puestoId, estado: "ACTIVO" } })).toBe(1);
    expect((await prisma.puesto.findUniqueOrThrow({ where: { id: puestoId } })).estado).toBe("OCUPADO");
  });

  it("permite una sola salida simultánea y finaliza el ingreso una vez", async () => {
    const ingreso = await prisma.ingreso.create({
      data: { clienteId, vehiculoId, puestoId },
    });

    const intentarSalida = () => prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124021, ${vehiculoId}::integer)`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(78124020, ${puestoId}::integer)`;
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

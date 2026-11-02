import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import prisma from "../../config/prisma.js";

let fixtureCounter = 0;
let clienteId = 0;
let vehiculoId = 0;
let vehiculosIds: number[] = [];
let puestoId = 0;
let puestosIds: number[] = [];
let usuariosIds: number[] = [];
let cajasIds: number[] = [];
let gastosIds: number[] = [];

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
  puestosIds = [puestoId];
});

afterEach(async () => {
  if (vehiculoId) {
    await prisma.ingreso.deleteMany({ where: { vehiculoId: { in: vehiculosIds } } });
    await prisma.vehiculo.deleteMany({ where: { id: { in: vehiculosIds } } });
  }
  if (puestosIds.length) await prisma.puesto.deleteMany({ where: { id: { in: puestosIds } } });
  if (clienteId) await prisma.cliente.deleteMany({ where: { id: clienteId } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Concurrencia de ingresos y salidas (PostgreSQL real)", () => {
  it("permite una sola entrada simultánea al mismo puesto desde vehículos diferentes", async () => {
    const segundoVehiculo = await prisma.vehiculo.create({
      data: {
        placa: `PL-SEG-${process.pid}-${fixtureCounter}`,
        clienteId,
        tipo: "carro",
      },
    });
    vehiculosIds.push(segundoVehiculo.id);

    const intentarEntrada = (idVehiculo: number) => prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${idVehiculo}::integer)) AS advisory_lock`;
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${puestoId}::integer)) AS advisory_lock`;

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

  it("impide dos entradas simultáneas del mismo vehículo en puestos diferentes", async () => {
    const segundoPuesto = await prisma.puesto.create({
      data: {
        codigo: `P-SEG-${process.pid}-${fixtureCounter}`,
        tipoPuesto: "carro",
        estado: "LIBRE",
      },
    });
    puestosIds.push(segundoPuesto.id);

    const intentarEntrada = (idPuesto: number) => prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${vehiculoId}::integer)) AS advisory_lock`;
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${idPuesto}::integer)) AS advisory_lock`;

      const existente = await tx.ingreso.findFirst({
        where: { vehiculoId, estado: "ACTIVO" },
        select: { id: true },
      });
      if (existente) return false;

      const puestoActualizado = await tx.puesto.updateMany({
        where: { id: idPuesto, activo: true, estado: "LIBRE" },
        data: { estado: "OCUPADO" },
      });
      if (puestoActualizado.count !== 1) return false;

      await tx.ingreso.create({ data: { clienteId, vehiculoId, puestoId: idPuesto } });
      return true;
    });

    const resultados = await Promise.all([intentarEntrada(puestoId), intentarEntrada(segundoPuesto.id)]);

    expect(resultados.filter(Boolean)).toHaveLength(1);
    expect(await prisma.ingreso.count({ where: { vehiculoId, estado: "ACTIVO" } })).toBe(1);
  });

  it("permite una sola salida simultánea y finaliza el ingreso una vez", async () => {
    const ingreso = await prisma.ingreso.create({
      data: { clienteId, vehiculoId, puestoId },
    });

    const intentarSalida = () => prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124021, ${vehiculoId}::integer)) AS advisory_lock`;
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124020, ${puestoId}::integer)) AS advisory_lock`;
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124019)) AS advisory_lock`;

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


describe("Concurrencia de caja y gastos recurrentes (PostgreSQL real)", () => {
  async function crearUsuarioDePrueba() {
    const suffix = `cash-${process.pid}-${Date.now()}-${fixtureCounter}`;
    const usuario = await prisma.usuario.create({
      data: {
        nombre: "Usuario de prueba",
        usuario: `usr-${suffix}`,
        correo: `usr-${suffix}@test.local`,
        password: "hash-de-prueba",
        rol: "admin",
      },
    });
    usuariosIds.push(usuario.id);
    return usuario;
  }

  it("serializa aperturas concurrentes y deja una sola caja ABIERTA", async () => {
    const usuario = await crearUsuarioDePrueba();

    const intentarApertura = () => prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124019)) AS advisory_lock`;
      const existente = await tx.caja.findFirst({ where: { estado: "ABIERTA" } });
      if (existente) return false;
      const caja = await tx.caja.create({
        data: { apertura: 50000, estado: "ABIERTA", usuarioId: usuario.id },
      });
      cajasIds.push(caja.id);
      return true;
    });

    const resultados = await Promise.all([intentarApertura(), intentarApertura()]);

    expect(resultados.filter(Boolean)).toHaveLength(1);
    expect(await prisma.caja.count({ where: { estado: "ABIERTA" } })).toBe(1);
  });

  it("genera una sola ocurrencia de gasto recurrente y la vincula a su movimiento", async () => {
    const usuario = await crearUsuarioDePrueba();
    const caja = await prisma.caja.create({
      data: { apertura: 0, estado: "ABIERTA", usuarioId: usuario.id },
    });
    cajasIds.push(caja.id);

    const fechaProgramada = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const plantilla = await prisma.gasto.create({
      data: {
        concepto: "Gasto recurrente de prueba",
        categoria: "pruebas",
        valor: 12000,
        recurrente: true,
        periodicidad: "mensual",
        proximaGeneracion: fechaProgramada,
      },
    });
    gastosIds.push(plantilla.id);

    const intentarGeneracion = () => prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(78124019)) AS advisory_lock`;
      const cajaAbierta = await tx.caja.findFirst({ where: { estado: "ABIERTA" } });
      if (!cajaAbierta) return false;

      const actual = await tx.gasto.findUnique({ where: { id: plantilla.id } });
      if (!actual?.recurrente || !actual.proximaGeneracion || actual.proximaGeneracion > new Date()) return false;

      const reclamado = await tx.gasto.updateMany({
        where: { id: actual.id, recurrente: true, proximaGeneracion: actual.proximaGeneracion },
        data: { proximaGeneracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
      if (reclamado.count !== 1) return false;

      const ocurrencia = await tx.gasto.create({
        data: {
          concepto: actual.concepto,
          categoria: actual.categoria,
          valor: actual.valor,
          fecha: new Date(),
          recurrente: false,
        },
      });
      gastosIds.push(ocurrencia.id);
      await tx.cajaMovimiento.create({
        data: {
          cajaId: cajaAbierta.id,
          tipo: "EGRESO",
          concepto: `Gasto recurrente: ${actual.concepto}`,
          monto: actual.valor,
          gastoId: ocurrencia.id,
        },
      });
      return true;
    });

    const resultados = await Promise.all([intentarGeneracion(), intentarGeneracion()]);

    expect(resultados.filter(Boolean)).toHaveLength(1);
    const ocurrencias = await prisma.gasto.findMany({
      where: { id: { in: gastosIds }, recurrente: false },
    });
    expect(ocurrencias).toHaveLength(1);
    const movimiento = await prisma.cajaMovimiento.findFirst({
      where: { cajaId: caja.id, gastoId: ocurrencias[0].id },
    });
    expect(movimiento?.tipo).toBe("EGRESO");
    expect(movimiento?.monto).toBe(12000);
  });
});

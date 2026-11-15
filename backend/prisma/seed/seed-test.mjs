/**
 * Datos base MÍNIMOS para la base de datos de pruebas (parqueadero_test).
 * Idempotente: se ejecuta antes de la suite de integración.
 *
 * Uso: node scripts/seed-test.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const url = process.env.DATABASE_URL || "";
  if (!/parqueadero_test/.test(url)) {
    console.error("ABORTADO: este seed solo debe correr sobre la base de datos de pruebas (parqueadero_test).");
    process.exit(1);
  }

  // Plan base de 30 días (lo exigen las pruebas de plan/cobro).
  const plan = await prisma.plan.findFirst({ where: { duracionDias: 30 } });
  if (!plan) {
    await prisma.plan.create({
      data: {
        nombre: "TEST Mensual 30",
        descripcion: "Plan de prueba",
        duracionDias: 30,
        valor: 150000,
        tipoVehiculo: "todos",
        activo: true,
      },
    });
    console.log("Plan de prueba creado");
  }

  // Tarifas base por tipo/modalidad (las pruebas de cobro las usan).
  const tarifas = [
    { nombre: "TEST Carro hora", tipoVehiculo: "carro", modalidad: "hora", valor: 5000, minutosCortesia: 10 },
    { nombre: "TEST Moto hora", tipoVehiculo: "moto", modalidad: "hora", valor: 3000, minutosCortesia: 10 },
  ];
  for (const t of tarifas) {
    const existe = await prisma.tarifa.findFirst({ where: { nombre: t.nombre } });
    if (!existe) await prisma.tarifa.create({ data: { ...t, activa: true } });
  }

  // Puestos base libres (los requieren las pruebas de plan/cobro).
  const puestos = [
    { codigo: "TEST-P1", tipoPuesto: "carro", zona: "Test" },
    { codigo: "TEST-P2", tipoPuesto: "carro", zona: "Test" },
    { codigo: "TEST-P3", tipoPuesto: "moto", zona: "Test" },
  ];
  for (const p of puestos) {
    const existe = await prisma.puesto.findFirst({ where: { codigo: p.codigo } });
    if (!existe) await prisma.puesto.create({ data: { ...p, estado: "LIBRE", activo: true } });
  }

  console.log("SEED TEST OK");
}

main()
  .catch((e) => {
    console.error("SEED TEST FALLÓ:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

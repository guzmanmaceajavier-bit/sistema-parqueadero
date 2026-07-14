import prisma from "./src/config/prisma.js";
import bcrypt from "bcrypt";

const TARIFAS_BASE = [
  { nombre: "Moto por minuto", tipoVehiculo: "moto", modalidad: "minuto", valor: 10, minutosCortesia: 0 },
  { nombre: "Moto por hora", tipoVehiculo: "moto", modalidad: "hora", valor: 1500, minutosCortesia: 15 },
  { nombre: "Moto diario", tipoVehiculo: "moto", modalidad: "diario", valor: 8000, minutosCortesia: 0 },
  { nombre: "Moto semanal", tipoVehiculo: "moto", modalidad: "semanal", valor: 35000, minutosCortesia: 0 },
  { nombre: "Moto mensual", tipoVehiculo: "moto", modalidad: "mensual", valor: 80000, minutosCortesia: 0 },
  { nombre: "Carro por minuto", tipoVehiculo: "carro", modalidad: "minuto", valor: 20, minutosCortesia: 0 },
  { nombre: "Carro por hora", tipoVehiculo: "carro", modalidad: "hora", valor: 3000, minutosCortesia: 10 },
  { nombre: "Carro diario", tipoVehiculo: "carro", modalidad: "diario", valor: 15000, minutosCortesia: 0 },
  { nombre: "Carro semanal", tipoVehiculo: "carro", modalidad: "semanal", valor: 60000, minutosCortesia: 0 },
  { nombre: "Carro mensual", tipoVehiculo: "carro", modalidad: "mensual", valor: 150000, minutosCortesia: 0 },
  { nombre: "Camioneta por hora", tipoVehiculo: "camioneta", modalidad: "hora", valor: 5000, minutosCortesia: 10 },
  { nombre: "Bicicleta por hora", tipoVehiculo: "bicicleta", modalidad: "hora", valor: 500, minutosCortesia: 0 },
  { nombre: "Otro por hora", tipoVehiculo: "otro", modalidad: "hora", valor: 3000, minutosCortesia: 10 },
];

async function seed() {
  const existe = await prisma.usuario.findFirst({ where: { OR: [{ usuario: "admin" }, { correo: "admin@parkadmin.com" }] } });

  if (!existe) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || adminPassword.length < 8) {
      console.error("FATAL: Define ADMIN_PASSWORD en .env (min 8 caracteres)");
      process.exit(1);
    }
    const hash = await bcrypt.hash(adminPassword, 10);
    await prisma.usuario.create({
      data: { nombre: "Administrador", usuario: "admin", correo: "admin@parkadmin.com", password: hash, rol: "admin" },
    });
    console.log("Usuario admin creado exitosamente!");
    console.log("  Usuario: admin");
  } else {
    console.log("El usuario admin ya existe.");
  }

  for (const t of TARIFAS_BASE) {
    const existente = await prisma.tarifa.findFirst({
      where: { tipoVehiculo: t.tipoVehiculo, modalidad: t.modalidad },
    });
    if (!existente) {
      await prisma.tarifa.create({ data: t });
      console.log(`  Tarifa creada: ${t.nombre}`);
    }
  }

  const PLANES_BASE = [
    { nombre: "Plan Diario", descripcion: "Estacionamiento por día", duracionDias: 1, valor: 15000, tipoVehiculo: "todos" },
    { nombre: "Plan Semanal", descripcion: "Estacionamiento por semana", duracionDias: 7, valor: 60000, tipoVehiculo: "todos" },
    { nombre: "Plan Quincenal", descripcion: "Estacionamiento por 15 días", duracionDias: 15, valor: 100000, tipoVehiculo: "todos" },
    { nombre: "Plan Mensual", descripcion: "Estacionamiento por mes", duracionDias: 30, valor: 150000, tipoVehiculo: "todos" },
  ];
  for (const p of PLANES_BASE) {
    const existe = await prisma.plan.findFirst({ where: { nombre: p.nombre } });
    if (!existe) {
      await prisma.plan.create({ data: p });
      console.log(`  Plan creado: ${p.nombre}`);
    }
  }

  const puestosExistentes = await prisma.puesto.count();
  if (puestosExistentes === 0) {
    const puestos = [];
    for (let i = 1; i <= 20; i++) {
      puestos.push({ codigo: `A-${String(i).padStart(3, "0")}`, tipoPuesto: i <= 5 ? "moto" : "carro" });
    }
    await prisma.puesto.createMany({ data: puestos });
    console.log(`  20 puestos creados (A-001 a A-020)`);
  }

  console.log("\nSeed completado!");
}

seed()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

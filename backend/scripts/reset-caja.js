import prisma from "../src/config/prisma.js";

async function main() {
  console.log("Eliminando tablas viejas de caja...");
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "CajaMovimiento" CASCADE`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "Caja" CASCADE`);
  console.log("Tablas eliminadas. Ejecuta: npx prisma db push");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

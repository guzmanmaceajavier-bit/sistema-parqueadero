require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Add columns to Caja
  await p.$executeRawUnsafe(`ALTER TABLE "Caja" ADD COLUMN IF NOT EXISTS "usuarioId" INTEGER REFERENCES "Usuario"(id)`);
  await p.$executeRawUnsafe(`ALTER TABLE "Caja" ADD COLUMN IF NOT EXISTS "cierreEfectivo" DOUBLE PRECISION`);
  await p.$executeRawUnsafe(`ALTER TABLE "Caja" ADD COLUMN IF NOT EXISTS "cierreTarjeta" DOUBLE PRECISION`);
  await p.$executeRawUnsafe(`ALTER TABLE "Caja" ADD COLUMN IF NOT EXISTS "cierreTransferencia" DOUBLE PRECISION`);

  // Add columns to CajaMovimiento
  await p.$executeRawUnsafe(`ALTER TABLE "CajaMovimiento" ADD COLUMN IF NOT EXISTS "metodoPago" VARCHAR(20)`);

  console.log('Migration completed successfully');
}
main().catch(e => console.error('Error:', e.message)).finally(() => p.$disconnect());

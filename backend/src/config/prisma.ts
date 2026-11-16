import { PrismaClient, Prisma } from "@prisma/client";

// Prisma.Decimal serializa como string por defecto. El frontend histórico consume
// importes JSON como number; conservamos ese contrato en un único punto.
// Los importes se almacenan y calculan como Decimal en PostgreSQL/backend.
Object.defineProperty(Prisma.Decimal.prototype, "toJSON", {
  configurable: true,
  writable: true,
  value: function (this: Prisma.Decimal): number {
    return this.toNumber();
  },
});

const prisma = new PrismaClient();

export default prisma;

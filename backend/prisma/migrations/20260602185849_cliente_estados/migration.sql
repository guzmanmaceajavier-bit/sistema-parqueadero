-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "observaciones" TEXT,
ALTER COLUMN "estado" SET DEFAULT 'ACTIVO',
ALTER COLUMN "estado" SET DATA TYPE TEXT;

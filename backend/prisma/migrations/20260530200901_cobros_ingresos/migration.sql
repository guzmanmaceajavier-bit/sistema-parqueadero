/*
  Warnings:

  - You are about to drop the column `tipo` on the `Tarifa` table. All the data in the column will be lost.
  - You are about to drop the column `valorHora` on the `Tarifa` table. All the data in the column will be lost.
  - Added the required column `modalidad` to the `Tarifa` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nombre` to the `Tarifa` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipoVehiculo` to the `Tarifa` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Tarifa` table without a default value. This is not possible if the table is not empty.
  - Added the required column `valor` to the `Tarifa` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Tarifa_tipo_key";

-- AlterTable
ALTER TABLE "Ingreso" ADD COLUMN     "tiempoMinutos" INTEGER,
ADD COLUMN     "valorPagado" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Tarifa" DROP COLUMN "tipo",
DROP COLUMN "valorHora",
ADD COLUMN     "activa" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "minutosCortesia" INTEGER DEFAULT 0,
ADD COLUMN     "modalidad" TEXT NOT NULL,
ADD COLUMN     "nombre" TEXT NOT NULL,
ADD COLUMN     "tipoVehiculo" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "valor" DOUBLE PRECISION NOT NULL;

/*
  Warnings:

  - You are about to drop the column `tipo` on the `Puesto` table. All the data in the column will be lost.
  - Added the required column `tipoPuesto` to the `Puesto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Puesto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Puesto" DROP COLUMN "tipo",
ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tipoPuesto" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

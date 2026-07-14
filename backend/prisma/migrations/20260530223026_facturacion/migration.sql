/*
  Warnings:

  - You are about to drop the `Historial` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "correo" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "nit" TEXT,
ADD COLUMN     "telefono" TEXT;

-- DropTable
DROP TABLE "Historial";

-- CreateTable
CREATE TABLE "Factura" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "ingresoId" INTEGER NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Factura_numero_key" ON "Factura"("numero");

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_ingresoId_fkey" FOREIGN KEY ("ingresoId") REFERENCES "Ingreso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

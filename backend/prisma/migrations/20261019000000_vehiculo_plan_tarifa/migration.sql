-- AlterTable
ALTER TABLE "Vehiculo" ADD COLUMN "creadoPorPlan" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vehiculo" ADD COLUMN "tipoCobro" TEXT;
ALTER TABLE "Vehiculo" ADD COLUMN "planId" INTEGER;
ALTER TABLE "Vehiculo" ADD COLUMN "tarifaId" INTEGER;

-- AddForeignKey
ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_tarifaId_fkey" FOREIGN KEY ("tarifaId") REFERENCES "Tarifa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

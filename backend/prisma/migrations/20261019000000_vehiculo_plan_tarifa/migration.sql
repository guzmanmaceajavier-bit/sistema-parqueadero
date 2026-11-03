-- ============================================================================
-- Vehículo: plan / tarifa / tipo de cobro
-- ----------------------------------------------------------------------------
-- NOTA DE RECONCILIACIÓN:
--   Esta migración no quedó registrada en el historial de producción (Neon),
--   pero sus columnas y claves foráneas SÍ existen físicamente allí (se
--   aplicaron con `db push`). Para que `prisma migrate deploy` funcione tanto
--   en instalaciones nuevas como en bases existentes/producción, las
--   sentencias se escriben de forma idempotente:
--     * ADD COLUMN IF NOT EXISTS
--     * FKs dentro de bloques DO verificando pg_constraint
--   El resultado es el mismo y no se pierde información.
-- ============================================================================

-- AlterTable
ALTER TABLE "Vehiculo" ADD COLUMN IF NOT EXISTS "creadoPorPlan" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vehiculo" ADD COLUMN IF NOT EXISTS "tipoCobro" TEXT;
ALTER TABLE "Vehiculo" ADD COLUMN IF NOT EXISTS "planId" INTEGER;
ALTER TABLE "Vehiculo" ADD COLUMN IF NOT EXISTS "tarifaId" INTEGER;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Vehiculo_planId_fkey' AND conrelid = '"Vehiculo"'::regclass) THEN
    ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Vehiculo_tarifaId_fkey' AND conrelid = '"Vehiculo"'::regclass) THEN
    ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_tarifaId_fkey" FOREIGN KEY ("tarifaId") REFERENCES "Tarifa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- Snapshot del cálculo de cobro en la factura
-- ----------------------------------------------------------------------------
-- Permite reconstruir cómo se calculó un cobro (modalidad, tarifa, tiempo y
-- desglose), sin depender del estado actual de las tarifas.
-- Idempotente: seguro en instalaciones nuevas y existentes.
-- ============================================================================

ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "tarifaId" INTEGER;
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "modalidad" TEXT;
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "tiempoMinutos" INTEGER;
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "desglose" JSONB;

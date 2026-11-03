-- ============================================================================
-- Migración correctiva: campos de anulación auditable en CajaMovimiento
-- ----------------------------------------------------------------------------
-- Motivo:
--   En producción (Neon) la tabla "CajaMovimiento" existe, pero le faltan las
--   columnas y el índice introducidos en el commit b3339ce
--   ("feat(caja): agregar campos de anulacion auditable a movimientos").
--   Esas columnas se aplicaron solo con `db push` en local y nunca llegaron a
--   producción.
--
-- Faltaba en producción:
--   * CajaMovimiento.anulado          BOOLEAN NOT NULL DEFAULT false
--   * CajaMovimiento.anuladoEn        TIMESTAMP(3)
--   * CajaMovimiento.anuladoPor       TEXT
--   * CajaMovimiento.motivoAnulacion  TEXT
--   * Índice CajaMovimiento_cajaId_anulado_idx (cajaId, anulado)
--
-- Seguridad:
--   Todas las sentencias usan IF NOT EXISTS, por lo que son no-op donde las
--   columnas/índice ya existan (instalaciones nuevas con la reconciliación).
--   No elimina ni modifica datos.
-- ============================================================================

ALTER TABLE "CajaMovimiento" ADD COLUMN IF NOT EXISTS "anulado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CajaMovimiento" ADD COLUMN IF NOT EXISTS "anuladoEn" TIMESTAMP(3);
ALTER TABLE "CajaMovimiento" ADD COLUMN IF NOT EXISTS "anuladoPor" TEXT;
ALTER TABLE "CajaMovimiento" ADD COLUMN IF NOT EXISTS "motivoAnulacion" TEXT;

CREATE INDEX IF NOT EXISTS "CajaMovimiento_cajaId_anulado_idx" ON "CajaMovimiento"("cajaId", "anulado");

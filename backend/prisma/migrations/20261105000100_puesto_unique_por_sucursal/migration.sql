-- ============================================================================
-- Unicidad de Puesto por sucursal
-- ----------------------------------------------------------------------------
-- Antes: Puesto.codigo era único GLOBALMENTE (impedía tener "P-01" en dos
-- sedes). Ahora la unicidad es por (sucursalId, codigo).
-- Idempotente y no destructivo: solo cambia índices, no datos.
-- ============================================================================

DROP INDEX IF EXISTS "Puesto_codigo_key";

-- Índice único compuesto (permite el mismo código en sucursales distintas).
CREATE UNIQUE INDEX IF NOT EXISTS "Puesto_sucursalId_codigo_key" ON "Puesto"("sucursalId", "codigo");

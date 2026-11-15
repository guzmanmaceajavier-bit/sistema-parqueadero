-- Vincula cada movimiento de auditoría con el usuario que lo ejecutó.
-- La columna es nullable para conservar eventos históricos y procesos del sistema.
ALTER TABLE "Movimiento" ADD COLUMN IF NOT EXISTS "usuarioId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Movimiento_usuarioId_fkey'
  ) THEN
    ALTER TABLE "Movimiento"
      ADD CONSTRAINT "Movimiento_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Movimiento_usuarioId_createdAt_idx"
  ON "Movimiento"("usuarioId", "createdAt");
CREATE INDEX IF NOT EXISTS "Movimiento_sucursalId_createdAt_idx"
  ON "Movimiento"("sucursalId", "createdAt");

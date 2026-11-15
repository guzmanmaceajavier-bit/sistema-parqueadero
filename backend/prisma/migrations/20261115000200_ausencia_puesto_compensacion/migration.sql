ALTER TABLE "Ausencia"
  ADD COLUMN "puestoId" INTEGER,
  ADD COLUMN "mensualidadId" INTEGER,
  ADD COLUMN "diasCompensados" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "valorCompensado" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "compensacionDetalle" TEXT,
  ADD COLUMN "compensacionAplicadaAt" TIMESTAMP(3);

ALTER TABLE "Ausencia"
  ADD CONSTRAINT "Ausencia_puestoId_fkey"
  FOREIGN KEY ("puestoId") REFERENCES "Puesto"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Ausencia"
  ADD CONSTRAINT "Ausencia_mensualidadId_fkey"
  FOREIGN KEY ("mensualidadId") REFERENCES "Mensualidad"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Ausencia_puestoId_idx" ON "Ausencia"("puestoId");
CREATE INDEX "Ausencia_mensualidadId_idx" ON "Ausencia"("mensualidadId");

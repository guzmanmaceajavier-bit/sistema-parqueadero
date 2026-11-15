-- Associate every customer balance movement with the invoice that caused it.
ALTER TABLE "ClienteSaldoMovimiento"
ADD COLUMN "facturaId" INTEGER;

CREATE INDEX "ClienteSaldoMovimiento_facturaId_idx"
ON "ClienteSaldoMovimiento"("facturaId");

ALTER TABLE "ClienteSaldoMovimiento"
ADD CONSTRAINT "ClienteSaldoMovimiento_facturaId_fkey"
FOREIGN KEY ("facturaId") REFERENCES "Factura"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Reglas de negocio aprobadas (D1, D6, D8, D10) + propietarios + arqueo
-- ----------------------------------------------------------------------------
-- Aditivo e idempotente. No elimina ni modifica datos existentes.
-- ============================================================================

-- D1 — Anulación de facturas con auditoría
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "anulada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "anuladaEn" TIMESTAMP(3);
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "anuladoPor" TEXT;
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "motivoAnulacion" TEXT;

-- D8 — IVA
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "subtotal" DOUBLE PRECISION;
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "ivaPorcentaje" DOUBLE PRECISION;
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "ivaValor" DOUBLE PRECISION;

-- Cierre de caja — arqueo real
ALTER TABLE "Caja" ADD COLUMN IF NOT EXISTS "conteoEfectivo" DOUBLE PRECISION;
ALTER TABLE "Caja" ADD COLUMN IF NOT EXISTS "esperadoEfectivo" DOUBLE PRECISION;
ALTER TABLE "Caja" ADD COLUMN IF NOT EXISTS "diferenciaArqueo" DOUBLE PRECISION;

-- D10 — ventana de reserva
ALTER TABLE "Configuracion" ADD COLUMN IF NOT EXISTS "reservaVentanaHoras" INTEGER DEFAULT 24;

-- Historial de propietarios de vehículo
CREATE TABLE IF NOT EXISTS "VehiculoPropietario" (
    "id" SERIAL NOT NULL,
    "vehiculoId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehiculoPropietario_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VehiculoPropietario_vehiculoId_idx" ON "VehiculoPropietario"("vehiculoId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VehiculoPropietario_vehiculoId_fkey') THEN
    ALTER TABLE "VehiculoPropietario" ADD CONSTRAINT "VehiculoPropietario_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VehiculoPropietario_clienteId_fkey') THEN
    ALTER TABLE "VehiculoPropietario" ADD CONSTRAINT "VehiculoPropietario_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- D6 — libro de movimientos de saldo del cliente
CREATE TABLE IF NOT EXISTS "ClienteSaldoMovimiento" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "saldoAntes" DOUBLE PRECISION NOT NULL,
    "saldoDespues" DOUBLE PRECISION NOT NULL,
    "concepto" TEXT,
    "usuario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClienteSaldoMovimiento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClienteSaldoMovimiento_clienteId_idx" ON "ClienteSaldoMovimiento"("clienteId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClienteSaldoMovimiento_clienteId_fkey') THEN
    ALTER TABLE "ClienteSaldoMovimiento" ADD CONSTRAINT "ClienteSaldoMovimiento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Histórico inicial de propietarios: registrar el dueño actual de cada vehículo que aún no tenga fila.
INSERT INTO "VehiculoPropietario" ("vehiculoId", "clienteId", "desde")
SELECT v."id", v."clienteId", v."createdAt"
FROM "Vehiculo" v
WHERE NOT EXISTS (SELECT 1 FROM "VehiculoPropietario" vp WHERE vp."vehiculoId" = v."id");

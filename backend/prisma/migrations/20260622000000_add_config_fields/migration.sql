-- Add new config fields for metodosPago, pieFactura, intentosMaximos
ALTER TABLE "Configuracion" ADD COLUMN IF NOT EXISTS "pieFactura" TEXT;
ALTER TABLE "Configuracion" ADD COLUMN IF NOT EXISTS "metodosPago" TEXT DEFAULT 'efectivo,tarjeta,transferencia';
ALTER TABLE "Configuracion" ADD COLUMN IF NOT EXISTS "intentosMaximos" INTEGER DEFAULT 10;

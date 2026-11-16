-- Convierte importes almacenados como DOUBLE PRECISION a NUMERIC.
-- ROUND(..., 2) conserva el importe visible a centavos y elimina residuos binarios.
-- La conversión se ejecuta dentro de la migración transaccional de Prisma.
ALTER TABLE "Configuracion"
  ALTER COLUMN "iva" TYPE DECIMAL(5,2) USING ROUND("iva"::numeric, 2);

ALTER TABLE "Cliente"
  ALTER COLUMN "saldo" TYPE DECIMAL(14,2) USING ROUND("saldo"::numeric, 2);

ALTER TABLE "Ingreso"
  ALTER COLUMN "valorPagado" TYPE DECIMAL(14,2) USING ROUND("valorPagado"::numeric, 2);

ALTER TABLE "Tarifa"
  ALTER COLUMN "valor" TYPE DECIMAL(14,2) USING ROUND("valor"::numeric, 2),
  ALTER COLUMN "precioHoraAdicional" TYPE DECIMAL(14,2) USING ROUND("precioHoraAdicional"::numeric, 2),
  ALTER COLUMN "precioPrimeraHora" TYPE DECIMAL(14,2) USING ROUND("precioPrimeraHora"::numeric, 2),
  ALTER COLUMN "tarifaMaximaDiaria" TYPE DECIMAL(14,2) USING ROUND("tarifaMaximaDiaria"::numeric, 2);

ALTER TABLE "Caja"
  ALTER COLUMN "apertura" TYPE DECIMAL(14,2) USING ROUND("apertura"::numeric, 2),
  ALTER COLUMN "cierre" TYPE DECIMAL(14,2) USING ROUND("cierre"::numeric, 2),
  ALTER COLUMN "conteoEfectivo" TYPE DECIMAL(14,2) USING ROUND("conteoEfectivo"::numeric, 2),
  ALTER COLUMN "esperadoEfectivo" TYPE DECIMAL(14,2) USING ROUND("esperadoEfectivo"::numeric, 2),
  ALTER COLUMN "diferenciaArqueo" TYPE DECIMAL(14,2) USING ROUND("diferenciaArqueo"::numeric, 2);

ALTER TABLE "CajaMovimiento"
  ALTER COLUMN "monto" TYPE DECIMAL(14,2) USING ROUND("monto"::numeric, 2);

ALTER TABLE "Plan"
  ALTER COLUMN "valor" TYPE DECIMAL(14,2) USING ROUND("valor"::numeric, 2);

ALTER TABLE "Mensualidad"
  ALTER COLUMN "valor" TYPE DECIMAL(14,2) USING ROUND("valor"::numeric, 2);

ALTER TABLE "Gasto"
  ALTER COLUMN "valor" TYPE DECIMAL(14,2) USING ROUND("valor"::numeric, 2);

ALTER TABLE "Factura"
  ALTER COLUMN "valor" TYPE DECIMAL(14,2) USING ROUND("valor"::numeric, 2),
  ALTER COLUMN "subtotal" TYPE DECIMAL(14,2) USING ROUND("subtotal"::numeric, 2),
  ALTER COLUMN "ivaPorcentaje" TYPE DECIMAL(5,2) USING ROUND("ivaPorcentaje"::numeric, 2),
  ALTER COLUMN "ivaValor" TYPE DECIMAL(14,2) USING ROUND("ivaValor"::numeric, 2);

ALTER TABLE "Ausencia"
  ALTER COLUMN "valorCompensado" TYPE DECIMAL(14,2) USING ROUND("valorCompensado"::numeric, 2);

ALTER TABLE "ClienteSaldoMovimiento"
  ALTER COLUMN "monto" TYPE DECIMAL(14,2) USING ROUND("monto"::numeric, 2),
  ALTER COLUMN "saldoAntes" TYPE DECIMAL(14,2) USING ROUND("saldoAntes"::numeric, 2),
  ALTER COLUMN "saldoDespues" TYPE DECIMAL(14,2) USING ROUND("saldoDespues"::numeric, 2);

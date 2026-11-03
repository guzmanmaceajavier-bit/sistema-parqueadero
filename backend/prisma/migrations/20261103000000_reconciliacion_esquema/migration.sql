-- ============================================================================
-- Migración de RECONCILIACIÓN de esquema (idempotente y no destructiva)
-- ----------------------------------------------------------------------------
-- Contexto:
--   El historial de migraciones solo describía el esquema inicial. Todo lo
--   posterior (tablas CajaMovimiento/PushSubscription/Sucursal, decenas de
--   columnas, FKs e índices) se aplicó con `prisma db push`, por lo que NUNCA
--   quedó representado aquí.
--
-- Objetivo:
--   Llevar CUALQUIER base al estado de schema.prisma:
--     * Instalación NUEVA  : se construye el esquema completo.
--     * Base EXISTENTE/prod: solo agrega lo que falta; lo que ya existe se omite.
--
-- Seguridad:
--   Todas las sentencias son idempotentes o están guardadas:
--     ADD COLUMN IF NOT EXISTS / DROP COLUMN IF EXISTS /
--     CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
--     DROP CONSTRAINT IF EXISTS / FKs dentro de bloques DO con pg_constraint.
--   No elimina datos: los únicos DROP son de columnas antiguas que NO existen
--   en las bases actuales (provienen del historial legado) y de FKs que se
--   recrean inmediatamente con la acción correcta (SET NULL).
-- ============================================================================

-- ─── FKs que deben recrearse con ON DELETE SET NULL ───
ALTER TABLE "Factura" DROP CONSTRAINT IF EXISTS "Factura_ingresoId_fkey";
ALTER TABLE "Reserva" DROP CONSTRAINT IF EXISTS "Reserva_puestoId_fkey";
ALTER TABLE "Reserva" DROP CONSTRAINT IF EXISTS "Reserva_vehiculoId_fkey";

-- ─── Ausencia ───
ALTER TABLE "Ausencia" ADD COLUMN IF NOT EXISTS "opcion" TEXT NOT NULL DEFAULT 'HISTORIAL',
ADD COLUMN IF NOT EXISTS "sucursalId" INTEGER;

-- ─── Caja (elimina columnas legadas del historial, agrega las actuales) ───
ALTER TABLE "Caja" DROP COLUMN IF EXISTS "fecha",
DROP COLUMN IF EXISTS "gastos",
DROP COLUMN IF EXISTS "ingresos",
ADD COLUMN IF NOT EXISTS "sucursalId" INTEGER;
ALTER TABLE "Caja" ADD COLUMN IF NOT EXISTS "usuarioId" INTEGER;
ALTER TABLE "Caja" ALTER COLUMN "usuarioId" SET NOT NULL;

-- ─── Cliente ───
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "bloqueado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "deseaReservar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "saldo" DOUBLE PRECISION DEFAULT 0;

-- ─── Configuracion ───
ALTER TABLE "Configuracion" ADD COLUMN IF NOT EXISTS "colorFondo" TEXT DEFAULT '#f8fafc',
ADD COLUMN IF NOT EXISTS "colorFondoLogin" TEXT DEFAULT '#f0fdf4',
ADD COLUMN IF NOT EXISTS "colorSecundario" TEXT DEFAULT '#14b8a6',
ADD COLUMN IF NOT EXISTS "fondoLogin" TEXT,
ADD COLUMN IF NOT EXISTS "formatoFecha" TEXT DEFAULT 'DD/MM/YYYY',
ADD COLUMN IF NOT EXISTS "formatoHora" TEXT DEFAULT '24h',
ADD COLUMN IF NOT EXISTS "formatoMoneda" TEXT DEFAULT 'COP',
ADD COLUMN IF NOT EXISTS "horarioApertura" TEXT DEFAULT '06:00',
ADD COLUMN IF NOT EXISTS "horarioCierre" TEXT DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS "idioma" TEXT DEFAULT 'es',
ADD COLUMN IF NOT EXISTS "iva" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS "mensajeWhatsappBienvenida" TEXT,
ADD COLUMN IF NOT EXISTS "mensajeWhatsappFactura" TEXT,
ADD COLUMN IF NOT EXISTS "mensajeWhatsappIngreso" TEXT,
ADD COLUMN IF NOT EXISTS "mensajeWhatsappRecordatorio" TEXT,
ADD COLUMN IF NOT EXISTS "mensajeWhatsappReserva" TEXT,
ADD COLUMN IF NOT EXISTS "mensajeWhatsappSalida" TEXT,
ADD COLUMN IF NOT EXISTS "mensajeWhatsappVencida" TEXT,
ADD COLUMN IF NOT EXISTS "minutosGracia" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "monedaSimbolo" TEXT DEFAULT '$',
ADD COLUMN IF NOT EXISTS "notificarEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "notificarWhatsappIngreso" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "notificarWhatsappReserva" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "notificarWhatsappSalida" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "notificarWhatsappVencimiento" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "paginacionPorDefecto" INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS "tamanoFuente" TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS "zonaHoraria" TEXT DEFAULT 'America/Bogota';
ALTER TABLE "Configuracion" ALTER COLUMN "colorPrincipal" SET DEFAULT '#0d9488';

-- ─── Factura ───
ALTER TABLE "Factura" ADD COLUMN IF NOT EXISTS "mensualidadId" INTEGER,
ADD COLUMN IF NOT EXISTS "origen" TEXT NOT NULL DEFAULT 'INGRESO',
ADD COLUMN IF NOT EXISTS "sucursalId" INTEGER;
ALTER TABLE "Factura" ALTER COLUMN "ingresoId" DROP NOT NULL;

-- ─── Gasto ───
ALTER TABLE "Gasto" ADD COLUMN IF NOT EXISTS "periodicidad" TEXT,
ADD COLUMN IF NOT EXISTS "proximaGeneracion" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "recurrente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "sucursalId" INTEGER;

-- ─── Ingreso ───
ALTER TABLE "Ingreso" ADD COLUMN IF NOT EXISTS "reservaId" INTEGER,
ADD COLUMN IF NOT EXISTS "ticketExtraviado" BOOLEAN NOT NULL DEFAULT false;

-- ─── Mensualidad ───
ALTER TABLE "Mensualidad" ADD COLUMN IF NOT EXISTS "planId" INTEGER,
ADD COLUMN IF NOT EXISTS "puestoId" INTEGER,
ADD COLUMN IF NOT EXISTS "sucursalId" INTEGER;

-- ─── Movimiento ───
ALTER TABLE "Movimiento" ADD COLUMN IF NOT EXISTS "sucursalId" INTEGER;

-- ─── Puesto ───
ALTER TABLE "Puesto" ADD COLUMN IF NOT EXISTS "sucursalId" INTEGER,
ADD COLUMN IF NOT EXISTS "zona" TEXT;

-- ─── Reserva ───
ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "sucursalId" INTEGER;
ALTER TABLE "Reserva" ALTER COLUMN "vehiculoId" DROP NOT NULL;
ALTER TABLE "Reserva" ALTER COLUMN "puestoId" DROP NOT NULL;

-- ─── Tarifa ───
ALTER TABLE "Tarifa" ADD COLUMN IF NOT EXISTS "minutosGratis" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "precioHoraAdicional" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "precioPrimeraHora" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "sucursalId" INTEGER,
ADD COLUMN IF NOT EXISTS "tarifaMaximaDiaria" DOUBLE PRECISION;

-- ─── Usuario ───
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "resetToken" TEXT,
ADD COLUMN IF NOT EXISTS "resetTokenExpires" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "sucursalId" INTEGER,
ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- ─── Vehiculo ───
ALTER TABLE "Vehiculo" ADD COLUMN IF NOT EXISTS "bloqueado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "sucursalId" INTEGER;

-- ─── Tablas que nunca estuvieron en el historial ───
CREATE TABLE IF NOT EXISTS "CajaMovimiento" (
    "id" SERIAL NOT NULL,
    "cajaId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "metodoPago" TEXT,
    "facturaId" INTEGER,
    "gastoId" INTEGER,
    "anulado" BOOLEAN NOT NULL DEFAULT false,
    "anuladoEn" TIMESTAMP(3),
    "anuladoPor" TEXT,
    "motivoAnulacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CajaMovimiento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "subscription" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Sucursal" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

-- ─── Índices ───
CREATE INDEX IF NOT EXISTS "CajaMovimiento_cajaId_idx" ON "CajaMovimiento"("cajaId");
CREATE INDEX IF NOT EXISTS "CajaMovimiento_cajaId_anulado_idx" ON "CajaMovimiento"("cajaId", "anulado");
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_usuarioId_key" ON "PushSubscription"("usuarioId");
CREATE UNIQUE INDEX IF NOT EXISTS "Ingreso_reservaId_key" ON "Ingreso"("reservaId");

-- ─── Claves foráneas (guardadas para no fallar si ya existen) ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Usuario_sucursalId_fkey' AND conrelid = '"Usuario"'::regclass) THEN
    ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Vehiculo_sucursalId_fkey' AND conrelid = '"Vehiculo"'::regclass) THEN
    ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Puesto_sucursalId_fkey' AND conrelid = '"Puesto"'::regclass) THEN
    ALTER TABLE "Puesto" ADD CONSTRAINT "Puesto_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Ingreso_reservaId_fkey' AND conrelid = '"Ingreso"'::regclass) THEN
    ALTER TABLE "Ingreso" ADD CONSTRAINT "Ingreso_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tarifa_sucursalId_fkey' AND conrelid = '"Tarifa"'::regclass) THEN
    ALTER TABLE "Tarifa" ADD CONSTRAINT "Tarifa_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Caja_sucursalId_fkey' AND conrelid = '"Caja"'::regclass) THEN
    ALTER TABLE "Caja" ADD CONSTRAINT "Caja_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Caja_usuarioId_fkey' AND conrelid = '"Caja"'::regclass) THEN
    ALTER TABLE "Caja" ADD CONSTRAINT "Caja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CajaMovimiento_cajaId_fkey' AND conrelid = '"CajaMovimiento"'::regclass) THEN
    ALTER TABLE "CajaMovimiento" ADD CONSTRAINT "CajaMovimiento_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "Caja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CajaMovimiento_facturaId_fkey' AND conrelid = '"CajaMovimiento"'::regclass) THEN
    ALTER TABLE "CajaMovimiento" ADD CONSTRAINT "CajaMovimiento_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CajaMovimiento_gastoId_fkey' AND conrelid = '"CajaMovimiento"'::regclass) THEN
    ALTER TABLE "CajaMovimiento" ADD CONSTRAINT "CajaMovimiento_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "Gasto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Mensualidad_planId_fkey' AND conrelid = '"Mensualidad"'::regclass) THEN
    ALTER TABLE "Mensualidad" ADD CONSTRAINT "Mensualidad_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Mensualidad_puestoId_fkey' AND conrelid = '"Mensualidad"'::regclass) THEN
    ALTER TABLE "Mensualidad" ADD CONSTRAINT "Mensualidad_puestoId_fkey" FOREIGN KEY ("puestoId") REFERENCES "Puesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Mensualidad_sucursalId_fkey' AND conrelid = '"Mensualidad"'::regclass) THEN
    ALTER TABLE "Mensualidad" ADD CONSTRAINT "Mensualidad_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Gasto_sucursalId_fkey' AND conrelid = '"Gasto"'::regclass) THEN
    ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Movimiento_sucursalId_fkey' AND conrelid = '"Movimiento"'::regclass) THEN
    ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Factura_ingresoId_fkey' AND conrelid = '"Factura"'::regclass) THEN
    ALTER TABLE "Factura" ADD CONSTRAINT "Factura_ingresoId_fkey" FOREIGN KEY ("ingresoId") REFERENCES "Ingreso"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Factura_mensualidadId_fkey' AND conrelid = '"Factura"'::regclass) THEN
    ALTER TABLE "Factura" ADD CONSTRAINT "Factura_mensualidadId_fkey" FOREIGN KEY ("mensualidadId") REFERENCES "Mensualidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Factura_sucursalId_fkey' AND conrelid = '"Factura"'::regclass) THEN
    ALTER TABLE "Factura" ADD CONSTRAINT "Factura_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reserva_puestoId_fkey' AND conrelid = '"Reserva"'::regclass) THEN
    ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_puestoId_fkey" FOREIGN KEY ("puestoId") REFERENCES "Puesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reserva_sucursalId_fkey' AND conrelid = '"Reserva"'::regclass) THEN
    ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reserva_vehiculoId_fkey' AND conrelid = '"Reserva"'::regclass) THEN
    ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Ausencia_sucursalId_fkey' AND conrelid = '"Ausencia"'::regclass) THEN
    ALTER TABLE "Ausencia" ADD CONSTRAINT "Ausencia_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

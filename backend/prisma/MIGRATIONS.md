# Estrategia de migraciones — SISTEMA PARQUEADERO

Documento de referencia para el manejo seguro de la base de datos con Prisma.
Aplica a instalaciones nuevas, instalaciones existentes, producción (Neon) y
despliegues en Render.

## 1. Regla de oro

- La base de datos se administra **solo con migraciones** (`prisma migrate`).
- **Nunca** usar `prisma db push` contra producción.
- **Nunca** usar `prisma migrate reset` sobre bases con datos reales.
- Las migraciones deben ser **aditivas y, preferiblemente, idempotentes**
  (`IF NOT EXISTS`, bloques `DO` para claves foráneas).

## 2. Scripts disponibles

| Script | Qué hace |
|---|---|
| `npm run migrate:status` | Muestra el estado de las migraciones. |
| `npm run migrate:deploy` | Aplica las migraciones pendientes (producción/CI). |
| `npm run migrate:diff` | Genera diffs entre historial/esquema/base. |
| `npm start` | Ejecuta `migrate deploy` y luego arranca el backend. |
| `npm run start:only` | Arranca el backend **sin** migrar (solo casos puntuales). |

## 3. Escenarios

### 3.1 Instalación nueva

1. Crear la base vacía.
2. `npm run migrate:deploy` (o `npm start`).
3. Listo: el esquema queda idéntico a `schema.prisma`.

Verificado: las 20 migraciones sobre una base vacía reproducen `schema.prisma`
exactamente (`migrate diff` vacío).

### 3.2 Instalación existente (base ya poblada)

`npm run migrate:deploy` aplica solo lo pendiente. Todas las migraciones nuevas
son idempotentes, por lo que no fallan ni borran datos si el objeto ya existe.

### 3.3 Producción (Neon)

> Neon requiere una conexión **directa (no pooled)** para migraciones.
> Configura `DATABASE_URL` (o una variable dedicada) con la cadena directa.

Pasos (con autorización):

1. Respaldo de la base (branch/snapshot en Neon).
2. `npm run migrate:status` para ver el faltante.
3. `npm run migrate:deploy`.
4. `npm run migrate:status` → debe decir "up to date".

### 3.4 Render

`npm start` ejecuta `prisma migrate deploy` antes de arrancar el backend.
Si la migración falla, el servicio **no arranca** (fail-fast), evitando servir
un backend con esquema desalineado.

## 4. Historial de reconciliación (contexto)

Durante mucho tiempo el esquema se modificó con `db push`, por lo que el
historial de migraciones quedó incompleto (faltaban las tablas
`CajaMovimiento`, `PushSubscription`, `Sucursal`, decenas de columnas, FKs e
índices). Se corrigió con:

- `20261103000000_reconciliacion_esquema` — idempotente. Lleva cualquier base
  al estado de `schema.prisma`: crea lo que falta, elimina con
  `DROP COLUMN IF EXISTS` únicamente columnas **legadas del historial** que no
  existen en las bases reales, y recrea FKs con la acción correcta.
- `20261103000100_cajamovimiento_anulacion` — idempotente. Repone las columnas
  `anulado`, `anuladoEn`, `anuladoPor`, `motivoAnulacion` y el índice
  `CajaMovimiento_cajaId_anulado_idx` que faltaban en producción. Es necesaria
  además de la reconciliación porque `CREATE TABLE IF NOT EXISTS` no agrega
  columnas a una tabla que ya existe.
- `20261019000000_vehiculo_plan_tarifa` — se reescribió de forma **idempotente**
  (`ADD COLUMN IF NOT EXISTS` + FKs en bloques `DO`). En producción no estaba
  registrada pero sus objetos ya existían; ahora `migrate deploy` la aplica sin
  error y la registra.

## 5. Crear una nueva migración (desarrollo)

```bash
cd backend
# 1. Editar prisma/schema.prisma
# 2. Generar la migración usando un shadow database local
npx prisma migrate dev --name descripcion_corta
# 3. Revisar el SQL generado en prisma/migrations/<timestamp>_<nombre>/migration.sql
# 4. Commitear el archivo (las migraciones SÍ deben versionarse)
```

> `migrate dev` usa `SHADOW_DATABASE_URL`. No apuntar el shadow a producción.

## 6. Verificaciones útiles

```bash
# ¿La base actual coincide con el esquema?  (salida vacía = OK)
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script

# ¿El historial de migraciones reproduce el esquema?  (salida vacía = OK)
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" --script
```

## 7. Qué NO hacer

- No `db push` en producción.
- No `migrate reset` con datos.
- No editar migraciones ya registradas sin justificar (puede alterar checksums;
  `migrate deploy` no falla, pero conviene evitarlo salvo reconciliación).
- No usar la base de producción como shadow database.
- No subir `.env` ni credenciales.

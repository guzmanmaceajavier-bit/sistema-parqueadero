# CONTEXTO DEL PROYECTO - SISTEMA PARQUEADERO

## 1. Objetivo

Continuar el desarrollo, revisión y preparación para producción del sistema de parqueadero.

Repositorio:
guzmanmaceajavier-bit/sistema-parqueadero

Rama de trabajo:
mejoras/seguridad-ux-logica

Trabajar sobre esta rama. No cambiar a main sin autorización.

## 2. Entorno técnico

- Backend: Node.js y TypeScript.
- ORM: Prisma 6.9.0.
- Base de datos: PostgreSQL.
- Producción: aplicación alojada en Render y base de datos alojada en Neon.
- Base local: PostgreSQL en localhost:5432.
- Frontend: carpeta frontend.
- Backend: carpeta backend.

## 3. Cambios realizados en esta sesión

### backend/package.json

Se cambió el script:

Antes:
"start": "npx prisma db push --skip-generate && tsx src/app.ts"

Ahora:
"start": "tsx src/app.ts"

Motivo:
Evitar que cada inicio o reinicio de Render modifique automáticamente el esquema de producción mediante prisma db push.

IMPORTANTE:
Todavía no se ha configurado migrate deploy como reemplazo. El historial de migraciones necesita reconciliación antes de habilitarlo.

### backend/prisma/schema.prisma

Se añadió:

shadowDatabaseUrl = env("SHADOW_DATABASE_URL")

Se utiliza una rama separada de Neon llamada shadow-parqueadero para las operaciones de shadow database.

No quitar esta configuración sin evaluar sus consecuencias.

## 4. Git y archivos

La rama está sincronizada con origin/mejoras/seguridad-ux-logica antes de los cambios actuales.

Cambios locales pendientes de guardar:
- backend/package.json
- backend/prisma/schema.prisma
- CONTEXTO_OPENCODE.md (este documento)

No se ha creado todavía un commit con estos cambios.

El archivo backend/.env está ignorado por Git.
No subir archivos .env, contraseñas, URLs de conexión ni secretos.

Las variables locales utilizadas incluyen:
- DATABASE_URL
- SHADOW_DATABASE_URL
- PRODUCTION_DATABASE_URL

No mostrar ni copiar sus valores en documentación, commits o mensajes.

## 5. Pruebas realizadas

- npm run typecheck: pasó anteriormente.
- npm test: 18 archivos de pruebas pasaron.
- Resultado: 91 de 91 pruebas pasaron.

Advertencia:
Algunas pruebas HTTP indicaron que no había backend disponible en el puerto 3001 y omitieron esa parte. No afirmar que esas pruebas HTTP fueron ejecutadas completamente.

## 6. Situación de las bases de datos

### Base local

- Está en localhost:5432.
- Se ejecutó prisma db push localmente.
- Se ejecutó prisma generate.
- La base local quedó sincronizada con schema.prisma.
- prisma migrate status indicó que las 18 migraciones están al día en local.

### Producción (Neon)

Rama:
production

También existe una rama separada:
shadow-parqueadero

En producción se verificó que hay 17 migraciones registradas en _prisma_migrations, mientras que el repositorio contiene 18.

La migración:
20261019000000_vehiculo_plan_tarifa

No aparece registrada en el historial de producción.

Sin embargo, se verificó mediante consultas de solo lectura que sus cuatro columnas y sus dos claves foráneas ya existen físicamente en Vehiculo:
- creadoPorPlan
- tipoCobro
- planId
- tarifaId
- Vehiculo_planId_fkey
- Vehiculo_tarifaId_fkey

Las dos claves foráneas tienen ON DELETE SET NULL y ON UPDATE CASCADE.

No registrar todavía esta migración como aplicada sin terminar la revisión y contar con autorización.

### Diferencia actual entre producción y schema.prisma

Se ejecutó:

prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script

Con DATABASE_URL apuntando temporalmente a producción.

El resultado mostró únicamente estas diferencias:

Faltan en producción:
- CajaMovimiento.anulado BOOLEAN NOT NULL DEFAULT false
- CajaMovimiento.anuladoEn TIMESTAMP(3)
- CajaMovimiento.anuladoPor TEXT
- CajaMovimiento.motivoAnulacion TEXT
- Índice CajaMovimiento_cajaId_anulado_idx sobre (cajaId, anulado)

Esta comparación fue de solo lectura. No se aplicó el SQL.

## 7. Problema del historial de migraciones

El historial de migraciones no representa completamente el esquema actual.

Se ejecutó:

prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url ...

El SQL resultante contenía numerosas diferencias, incluidas operaciones DROP COLUMN y DROP FOREIGN KEY.

NO ejecutar ese SQL.

Hay tablas y estructuras existentes en producción que no están representadas adecuadamente en el historial de migraciones, entre ellas:
- CajaMovimiento
- PushSubscription
- Sucursal

La producción tiene datos que deben conservarse.

Se necesita diseñar una estrategia segura de reconciliación y migraciones para instalaciones nuevas y existentes.

## 8. Reglas obligatorias de seguridad

NO ejecutar:
- prisma migrate reset
- prisma db push contra producción
- SQL generado por el diff grande sin revisión
- migraciones en producción sin autorización explícita
- comandos que borren tablas, columnas o datos

No marcar migraciones como aplicadas sin comprobar previamente que todos sus cambios existen físicamente.

No usar la base de producción como shadow database.

Antes de cualquier modificación de producción:
1. Revisar el SQL completo.
2. Comprobar columnas, índices, restricciones y claves foráneas.
3. Comprobar compatibilidad con datos existentes.
4. Preparar respaldo y plan de reversión.
5. Solicitar autorización.

## 9. Próximas tareas

1. Revisar los cambios locales y crear un commit de respaldo.
2. Revisar todas las migraciones y el schema actual.
3. Diseñar una estrategia de reconciliación del historial de Prisma.
4. Preparar una migración correctiva para las cuatro columnas y el índice faltantes de CajaMovimiento.
5. Determinar cómo registrar de forma segura la migración 20261019000000_vehiculo_plan_tarifa en producción.
6. Configurar el despliegue para usar migraciones controladas, no db push.
7. Revisar configuración de Render y variables de entorno.
8. Ejecutar pruebas y preparar el despliegue.

## 10. Instrucción inicial para OpenCode

Antes de modificar archivos:
- Lee este documento.
- Revisa git status y git diff.
- Inspecciona backend/package.json y backend/prisma/schema.prisma.
- Revisa las migraciones existentes.
- No asumas que la base local y la de producción tienen el mismo estado.
- No ejecutes comandos destructivos ni modifiques producción.
- Presenta un plan de trabajo antes de realizar cambios importantes.

El objetivo es terminar el proyecto de forma segura, conservar todos los datos y dejar un proceso de despliegue reproducible.

## 11. Sesión de reconciliación de migraciones (completada)

Se auditaron las 18 migraciones vs schema.prisma y se detectó que el historial
solo describía el esquema inicial (todo lo posterior se aplicó con `db push`).

Cambios preparados y verificados (sin tocar producción en la auditoría):

- `20261103000000_reconciliacion_esquema`: migración idempotente que lleva
  cualquier base al estado de schema.prisma (tablas CajaMovimiento,
  PushSubscription y Sucursal, columnas, FKs e índices faltantes). Usa
  `IF NOT EXISTS` / `IF EXISTS` y FKs guardadas en bloques `DO`.
- `20261103000100_cajamovimiento_anulacion`: repone en producción las columnas
  `anulado/anuladoEn/anuladoPor/motivoAnulacion` y el índice
  `CajaMovimiento_cajaId_anulado_idx`.
- `20261019000000_vehiculo_plan_tarifa`: reescrita de forma idempotente para
  que `migrate deploy` la registre en producción sin error (sus objetos ya
  existían físicamente).
- `.gitignore`: `!backend/prisma/migrations/**/*.sql` (antes las migraciones
  nuevas quedaban ignoradas por `*.sql`).
- `backend/package.json`: `start` ejecuta `prisma migrate deploy` antes de
  arrancar; scripts `migrate:status/deploy/diff` y `start:only`.
- `README.md` y `backend/prisma/MIGRATIONS.md`: instalación y estrategia
  documentadas (sin `db push`).

Verificaciones aprobadas: instalación nueva reproduce schema.prisma exacto;
simulación de producción (17 migraciones + faltantes) aplica limpio con
`migrate deploy`; typecheck OK; pruebas 91/91.

## 12. Despliegue a producción (Neon) — procedimiento

1. Respaldo previo con `pg_dump` (archivo local ignorado por Git).
2. Verificación read-only del estado (`migrate status` con
   PRODUCTION_DATABASE_URL).
3. `migrate deploy` apuntando a producción (conexión directa, no pooled).
4. Verificación final: status "up to date", columnas e índice presentes,
   `migrate diff` vacío.
5. Reversión: restaurar el respaldo pg_dump.

Reglas vigentes: nunca `db push` ni `migrate reset` contra producción; no usar
la base de producción como shadow database; no subir `.env` ni credenciales.

### 12.1 Ejecución real (2026-11-03) — COMPLETADA

- Respaldo previo con `pg_dump` (formato custom y plano) guardado fuera del
  repositorio, reversible con `pg_restore`.
- Primer `migrate deploy` falló en `20261103000000_reconciliacion_esquema`
  (42703: el índice `CajaMovimiento_cajaId_anulado_idx` se creaba antes de que
  existiera la columna `anulado` en la tabla ya existente). La transacción se
  revirtió: datos intactos.
- Corrección: el índice compuesto se crea dentro de un bloque `DO` solo si la
  columna `anulado` existe (instalaciones nuevas) y si el índice no existe. En
  bases donde la tabla ya existe sin la columna, lo crea la migración
  dedicada `20261103000100_cajamovimiento_anulacion` después de agregarla.
- Re-testeo aprobado (BD desechables): instalación nueva diff vacío;
  simulación fiel de producción (17 registradas + columnas eliminadas) aplicó
  las 3 migraciones y dejó diff vacío.
- Recuperación en producción: `migrate resolve --rolled-back` de la migración
  fallida + `migrate deploy` con conexión DIRECTA (sin pooler).
- Verificación final en producción: 20 migraciones, "Database schema is up to
  date", columnas `anulado/anuladoEn/anuladoPor/motivoAnulacion` e índice
  presentes, `migrate diff` vacío, datos íntegros.

Pendiente operativo: desplegar este código en Render (merge a la rama que
Render vigila) y confirmar en el log de arranque que `prisma migrate deploy`
se ejecuta antes del servidor.

# 11 — Pruebas existentes y cobertura

> Fuente: `backend/src/tests/` (18 archivos) + `backend/vitest.config.ts` + `.github/workflows/quality.yml`.

## 1. Infraestructura de pruebas

- **Runner**: Vitest 3 (`backend/package.json` → `"test": "vitest run"`).
- **Config**: `vitest.config.ts` (globals, node, setupFiles `src/tests/setup.ts`, timeout 10 s).
- **Integración PostgreSQL**: `test:integration` ejecuta `src/tests/integration/ingresos.postgres.test.ts`.
- **CI** (`.github/workflows/quality.yml`): en PR a `main` y push: typecheck + suite unitaria sin BD + build frontend + servicio Postgres 16 aplicando `prisma migrate deploy` y ejecutando la integración.

## 2. Inventario de pruebas (18 archivos, 91 tests según última ejecución)

| Archivo | Tipo | Qué cubre |
|---|---|---|
| `helpers/caja.test.ts` | unit | cálculos de caja; reserva vinculada; tarifas por tiempo facturable |
| `helpers/movimientos.test.ts` | unit | `registrarMovimiento` |
| `integration/ingresos.postgres.test.ts` | integración (PG real) | concurrencia entrada/salida, caja, gastos recurrentes, reservas/mensualidades, vencimientos |
| `middlewares/roles.middleware.test.ts` | unit | `verificarRol` (401/403/200) |
| `modules/dashboard.test.ts` | unit (mock) | `obtenerDashboard` |
| `modules/ingresos.test.ts` | unit | `buscarReservaActiva` |
| `modules/planes.test.ts` | mixto (unit + HTTP) | plan vigente/vencido, salida con plan, entrada duplicada, liberar sin plan |
| `modules/reportes.test.ts` | unit (mock) | `obtenerReporte` |
| `schemas/caja-gasto.test.ts` | unit | schemas Zod de caja y gastos |
| `schemas/usuario.test.ts` | unit | `crearUsuarioSchema` |
| `services/calculadorCobros.test.ts` | unit | modalidades, cortesía, progresiva, tope diario, ticket extraviado, validaciones |
| `services/gastos.test.ts` | unit | `calcularProximaGeneracion` |
| `services/ticket.test.ts` | unit | `generarTicketPDF` (genera buffer) |
| `utils/fechas.test.ts` | unit | `sumarMesesConTope` |
| `utils/periodoReporte.test.ts` | unit | `obtenerPeriodoReporte` |
| `utils/puestos.test.ts` | unit | `resumirEstadosPuestos` |
| `utils/saldos.test.ts` | unit | `calcularPagadoMensualidad` |
| `utils/sucursalAccess.test.ts` | unit | `resolverSucursalPermitida` |

## 3. Funcionalidades CON prueba

- Cálculo de tarifas (todas las modalidades, cortesía, progresiva, tope, extravío).
- Concurrencia: entrada simultánea mismo puesto; doble entrada mismo vehículo; doble salida; apertura de caja concurrente; gasto recurrente idempotente; reserva vs mensualidad simultáneas.
- Reserva vinculada a ingreso; vencimiento de mensualidad libera puesto.
- Roles (`verificarRol`).
- Fechas (fin de mes), saldos pagados, resumen de puestos, sucursal.
- Schemas Zod (caja, gasto, usuario).
- Ticket PDF.

## 4. Funcionalidades SIN prueba (confirmado)

- **Usuarios**: crear/editar/eliminar, protección último admin, cambio de contraseña, reset por token, refresh-token, bloqueo por intentos.
- **Clientes**: CRUD, importación, recarga de saldo, cierre de cuenta (`forzar`), perfil.
- **Vehículos**: CRUD, placa duplicada, suspensión.
- **Puestos**: CRUD, masivos, toggle, eliminación con historial.
- **Ingresos**: edición, `actualizarIngreso`, ticket de entrada.
- **Caja**: apertura/cierre/arqueo (excepto la concurrencia de apertura), anulación de movimientos, edición.
- **Mensualidades**: creación, renovación, cancelación, eliminación, `generarFacturasPendientes`.
- **Ausencias**: creación, finalización con opciones.
- **Gastos**: CRUD (solo la fecha de recurrencia está probada).
- **Facturas**: PDF, recibo, WhatsApp, filtros de sucursal.
- **Backup**: generar/restaurar.
- **Configuración**: guardar, `formatearSistema`.
- **Sucursales**: CRUD.
- **Reportes/Dashboard**: solo pruebas con mocks parciales; sin pruebas de datos reales.
- **Scheduler**: `liberarReservas`, `enviarRecordatorios` sin prueba directa (solo `vencerMensualidades` indirectamente).
- **Frontend**: sin pruebas de componentes ni E2E.

## 5. Pruebas dependientes de datos compartidos (frágiles)

- `modules/planes.test.ts`: usa la **BD real local** y crea filas con placa `TST888`/documento `999888777`; requiere al menos un plan de 30 días y puestos libres. Las pruebas HTTP se omiten si no hay backend en `:3001`. Si queda basura de una corrida previa, falla (observado en sesiones previas).
- `integration/ingresos.postgres.test.ts`: requiere Postgres real y `prisma db push` en CI; usa fixtures con sufijo por proceso.
- Duplicidad de IDs de lock (`78124018..22`) es global; pruebas concurrentes pueden interferir si corren en paralelo (por eso `workers:1`).

## 6. Riesgos de concurrencia (cubiertos y no cubiertos)

- **Cubiertos**: entrada/puesto, doble salida, abrir caja, gasto recurrente, reserva vs mensualidad.
- **No cubiertos**: cobro de mensualidad concurrente (`cobrarMensualidad` tiene lock pero sin prueba), renovación concurrente, ausencia concurrente con ingreso, edición de ingreso concurrente, cerrar caja mientras se cobra una suscripción.

## 7. Conclusión de cobertura

- **Bien probado**: motor de cobro, utilidades puras, concurrencia de ingresos/caja/reservas.
- **Sin cobertura**: la mayoría de CRUD de entidades, permisos reales por endpoint, flujo completo de suscripciones, backup/restore, formateo, frontend.
- **Sin E2E**: no existen pruebas de navegador; la verificación de interfaz fue manual.

> Nota: se dejó de lado la infraestructura Playwright (aprobada en una fase anterior) por decisión del solicitante; este documento refleja el estado actual del repositorio.

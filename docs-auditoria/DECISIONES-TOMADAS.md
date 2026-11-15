# DECISIONES TOMADAS (aprobadas por delegación)

> El propietario delegó la decisión técnica. Se adoptan las opciones que más benefician al
> proyecto en funcionamiento real, integridad contable, seguridad y multi-sede.
> Cada decisión queda registrada aquí como referencia y para trazabilidad.

## D1 — Anulación de facturas → **Anular con contrapartida y auditoría**
- D1-a: **Sí** se puede anular aunque la caja esté cerrada → genera ajuste en la caja abierta actual.
- D1-b: **Sí** se devuelve el saldo del cliente usado en la factura anulada.
- D1-c: **Sí**, anular una factura de mensualidad revierte la renovación automática (recalcula el período).
- D1-d: **Admin y supervisor** pueden anular (con motivo obligatorio).

## D7 — Clientes → **Globales con visibilidad por sucursal**
- D7-a: Un cliente recién creado lo ve quien lo creó + admin; se comparte al operarlo en otra sede.
- D7-b: **Visibilidad derivada** de operaciones (sin tabla nueva), admin ve todo.

## D10 — Reservas → **Disponibilidad por fechas**
- D10-a: El puesto se marca RESERVADO dentro de una **ventana de 24 h** antes del inicio (configurable).
- D10-b: Reservas existentes **conviven** (no se migran); se aplica la nueva lógica al recomputar.

## D4 — Puestos masivos → **Sede opcional pero respetada**
- El schema acepta `sucursalId`; la numeración filtra por sede; mismo código permitido en sedes distintas.
- Puestos sin sede se permiten (instalación de una sola sede).

## D5 — Intentos de login → **Configurable con tope seguro**
- `intentosMaximos` de configuración gobierna el bloqueo real (rango 3–10, default 5).
- Duración de bloqueo: 15 min fijo.

## D6 — Saldo del cliente → **Global por cliente + historial de movimientos**
- Se mantiene saldo global (billetera del cliente) y se agrega **libro de movimientos de saldo**.

## D8 — IVA → **Configurable; precios SIN IVA por defecto**
- Si `iva > 0`, se calcula por encima y se guarda `subtotal`, `iva`, `total` en la factura.
- Por defecto `iva = 0` (no cambia el comportamiento actual).

## D9 — Aforo global → **Solo por puestos** (sin límite separado)
- La capacidad se determina por los puestos (como hoy). No se agrega aforo máximo.

## D11 — Estado de puesto → **Derivado; manual solo LIBRE/MANTENIMIENTO**
- OCUPADO/RESERVADO/AUSENCIA se calculan automáticamente. El admin solo puede LIBRE↔MANTENIMIENTO.

## O7 — Tarifas duplicadas → **Impedir duplicados del mismo alcance**
- Al crear/editar, no puede haber dos tarifas activas para el mismo tipo+modalidad+sucursal. Error explícito.

## Pago → **Mantener `Factura` con `metodoPago`** (sin entidad nueva)
- Suficiente para un parqueadero; se evita complejidad. Se documenta.

## Historial de propietarios → **Sí, tabla `VehiculoPropietario`**
- Conserva el dueño anterior con rango de fechas; la relación actual sigue en `Vehiculo.clienteId`.

## Renovaciones → **Unificar: siempre crear período nuevo**
- `cobrarMensualidad` deja de reescribir el registro; al saldar crea un período nuevo (conserva historial).

## Recurrentes → **Automatizar con el scheduler diario**
- El scheduler genera gastos recurrentes vencidos, sin duplicar, respetando sucursal.

## Cierre de caja → **Guardar conteo/diferencia en columnas**
- `conteoEfectivo`, `esperadoEfectivo`, `diferencia` como campos, además del detalle.

---

## Estado de implementación (2026-11-05)

| Decisión | Implementado | Dónde |
|---|---|---|
| D1 anulación de facturas | Sí | `POST /api/facturas/:id/anular` (admin/supervisor) + campos en `Factura` + exclusiones en dashboard/reportes + botón en `Facturas.tsx` |
| D1-b devolver saldo | Sí | `ClienteSaldoMovimiento` tipo DEVOLUCION |
| D7 visibilidad por sucursal | Sí | `obtenerClientes` filtra por relaciones con la sede |
| D10 reservas por fechas | Sí | Ventana configurable (`reservaVentanaHoras`, 24 h) + scheduler |
| D4 puestos masivos con sede | Sí | `sucursalId` en schema + numeración por sede |
| D5 intentos configurables | Sí | `intentosMaximos` (rango 3-10) gobierna el bloqueo real |
| D6 libro de saldo | Sí | `ClienteSaldoMovimiento` (RECARGA/CONSUMO/DEVOLUCION/AJUSTE) |
| D8 IVA | Sí | `subtotal/ivaPorcentaje/ivaValor` en Factura (0 = sin IVA, comportamiento actual) |
| D11 estado derivado | Sí | Backend rechaza estado manual OCUPADO/RESERVADO/AUSENCIA |
| O7 tarifas duplicadas | Sí | Bloqueo al crear/editar duplicados activos |
| Propietarios | Sí | `VehiculoPropietario` + registro en cambio de dueño |
| Renovaciones unificadas | Sí | Cobro que salda crea periodo nuevo y marca el anterior VENCIDA |
| Recurrentes automáticos | Sí | Scheduler diario 00:05 |
| Cierre con arqueo | Sí | Columnas en `Caja` |
| D9 aforo | No aplica | La capacidad son los puestos |

Migración aplicada: `20261105000200_reglas_negocio_d1_d6_d8_d10` (idempotente, aditiva).

Pruebas: 96/96 (19 archivos) con base de datos aislada (`parqueadero_test`).
`vitest.config.ts` separa proyectos `unit` e `integration`; la integración usa
`backend/.env.test` (ignorado por git) y corre en serie para no interferir.
Seed mínimo: `backend/prisma/seed/seed-test.mjs` (`npm run test:db:setup`).

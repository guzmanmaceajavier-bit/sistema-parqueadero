# IMPLEMENTACIÓN — Hecho vs. pedido

> Fecha: 2026-11-05. Rama `main`. Base local `parqueadero_db`.
> **Decisiones de negocio asumidas** (recomendadas, cambiables):
> 1. Vencimiento con vehículo dentro → cobrar **solo el excedente** desde el vencimiento.
> 2. Renovación anticipada → **comenzar después del vencimiento actual**.
> 3. Plan mensual → **puede tener puesto fijo o flexible**.
> 4. Plan vencido sin renovar → **liberar la reserva, nunca un puesto ocupado**.

---

## ✅ Lo que se hizo (vs. hallazgos de la segunda auditoría)

### A1 — Vencimiento con el vehículo dentro · **RESUELTO**
- `backend/src/services/scheduler.ts`: al vencer una mensualidad, si hay `Ingreso ACTIVO` en el puesto, **no lo libera** (lo mantiene OCUPADO); solo libera/reserva si no hay vehículo dentro.
- `backend/src/modules/ingresos/ingresos.controller.ts`: `registrarSalidaConCobro` y `simularCobro` detectan la mensualidad que **cubría la entrada** aunque ya esté VENCIDA, y cobran **solo el excedente** desde `fechaFin` (nuevo parámetro `excedente`). Se añadió el modo `EXCEDENTE` en la salida, con revalidación transaccional y snapshot.
- Frontend `Ingresos.tsx`: muestra "El plan venció durante la estancia: solo se cobra el tiempo excedente" y el botón pasa a "Registrar salida y cobrar".

### A3 — Ausencia con plan vigente · **RESUELTO**
- `backend/src/modules/ausencias/ausencias.controller.ts`: `crearAusencia` ahora consulta la mensualidad vigente; si existe, **no genera factura** (`valorPagado = 0`); solo factura si no hay cobertura. Uniformado el filtro por sucursal.

### A2 — Renovación concurrente · **RESUELTO**
- `backend/src/modules/mensualidades/mensualidades.controller.ts`: `cobrarMensualidad` ahora adquiere **los mismos locks** (vehículo `78124021` y puesto `78124020`) que `renovarMensualidad`, además del lock de mensualidad y el de caja. Así "cobrar" y "renovar" no pueden ejecutarse en paralelo y duplicar período.

### B1 — Tipo de puesto vs tipo de vehículo · **RESUELTO**
- Helper `puestoAceptaTipo()` en ingresos, mensualidades y reservas. Se valida en `registrarIngreso`, `actualizarIngreso`, `crearMensualidad` y `crearReserva`. Rechaza 400 si el tipo no es compatible (tolera "todos" y puestos sin tipo).

### B2 — Snapshot de tarifa/desglose · **RESUELTO**
- `schema.prisma`: `Factura` ahora tiene `tarifaId`, `modalidad`, `tiempoMinutos`, `desglose` (Json).
- Migración `20261105000000_factura_snapshot_cobro` (idempotente).
- `registrarSalidaConCobro` guarda el desglose del cálculo en la factura (modalidad, tiempo, detalle).

### B3 — Unicidad de puesto por sucursal · **RESUELTO**
- `schema.prisma`: `Puesto.codigo @unique` → `@@unique([sucursalId, codigo])`.
- Migración `20261105000100_puesto_unique_por_sucursal` (drop índice viejo + crea compuesto, idempotente).
- `puestos.controller.ts`: verificación de existencia y `siguienteNumeroPuesto` ahora **por sucursal**.

### B7 — `formatearSistema` con errores silenciados · **RESUELTO**
- `configuracion.controller.ts`: acumula errores por modelo y responde **207** con el detalle, en vez de fingir éxito.

### B8 — Permisos UI · **RESUELTO**
- `AppRouter.tsx`: `/tarifas` y `/planes` ahora bajo `allowedRoles=["admin","supervisor"]`; se eliminó la duplicación de rutas.
- `Clientes.tsx`, `Vehiculos.tsx`, `Ingresos.tsx`, `Ausencias.tsx`: el botón **Eliminar** ahora solo se muestra a `isAdmin` (coincide con el backend).

### C6 — Normalización de placa · **RESUELTO**
- `vehiculos.controller.ts`: `normalizarPlaca()` quita espacios y guiones (mayúsculas). `ABC-123` = `ABC123`.
- `C7` — `sucursales.controller.ts` + rutas: validaciones de nombre, longitudes y `validateIdParam`.
- Revisión adicional: se cerró una caja residual de pruebas locales que hacía fallar los tests de integración (dato de prueba, no producto).

---

## ✅ Verificación

- `npm run typecheck` (backend): **OK**.
- `npm test` (backend): **91/91** (18 archivos) **OK**.
- `npm run build` (frontend): **OK**.
- Migraciones aplicadas localmente: `20261105000000_factura_snapshot_cobro`, `20261105000100_puesto_unique_por_sucursal`.
- Cliente Prisma regenerado.

---

## ⏳ Pendiente / no incluido (requiere tu decisión o mayor alcance)

| # | Tema | Estado | Motivo |
|---|---|---|---|
| A4 | Historial de propietarios de vehículo | **No implementado** | Requiere nueva entidad `VehiculoPropietario` + migración + UI. Cambio mayor; conviene decidir el modelo de datos. |
| A5 | Entidad `Pago` independiente | **No implementado** | Decisión de negocio (D8). Hoy se usa `Factura`; migrar es un cambio estructural. |
| B4 | Plan sin puesto fijo vs puestos reservados | **Mitigado** | Ya hay validación de reservas ajenas en `puestoEstaDisponibleParaAsignar`; falta prueba dedicada. |
| B5 | Ausencia `EXTENDER/DESCONTAR` sin filtro de sucursal | **Pendiente** | Impacto bajo (1 vehículo = 1 sucursal). Se puede uniformar si operas multi-sede real. |
| C1/C2 | Duplicación `Vehiculo.planId` vs `Mensualidad.planId` | **Pendiente** | Rediseño de fuente de verdad; conviene planificarlo. |
| — | IVA (`config.iva`) | **Pendiente** | Hoy no se calcula en `calculadorCobros`. Decisión D11. |
| — | Aforo global del parqueadero | **Pendiente** | Regla no existente; decisión D6. |
| — | Cobertura de pruebas nuevas | **Pendiente** | Faltan pruebas para A1/A2/A3/B1/B2/B3. Recomendado crearlas. |
| — | Restaurar backup / formatear | **Pendiente de prueba E2E** | No se ejecutaron por ser destructivos. |
| — | Despliegue a producción (Neon/Render) | **No ejecutado** | Requiere autorización explícita. |

---

## Notas
- No se tocó producción ni Neon.
- Los cambios están en local; **no se ha hecho push ni deploy**.
- Las 4 decisiones de negocio asumidas quedan explícitas arriba; si cambias alguna, ajusto A1 en consecuencia.

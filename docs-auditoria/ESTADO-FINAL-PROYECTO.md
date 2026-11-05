# ESTADO FINAL DEL PROYECTO — qué se hizo y qué falta

> Fecha: 2026-11-05. Rama `main`. **2 commits locales sin push** (`ad9c8c1`, `e8c1df3`).
> No se tocó producción ni Neon.

---

## ✅ Completado y verificado

### Correcciones de negocio e integridad (commits `ad9c8c1` + `e8c1df3`)
| ID | Corrección |
|---|---|
| A1 | Vencimiento con vehículo dentro: el puesto permanece OCUPADO; salida cobra solo el excedente |
| A3 | Ausencia con plan vigente: no genera cobro |
| A2 | Renovación concurrente: `cobrarMensualidad` usa los mismos locks que `renovarMensualidad` |
| B1 | Validación tipo puesto ↔ tipo vehículo en backend (ingresos, mensualidades, reservas) |
| B2 | Snapshot de cobro en `Factura` (tarifa, modalidad, tiempo, desglose) + migración |
| B3 | Unicidad de puesto por sucursal `@@unique([sucursalId, codigo])` + migración |
| B7 | `formatearSistema` reporta errores (207) |
| B8 | Permisos UI: rutas tarifas/planes con guard; botones destructivos ocultos a no-admin |
| C6 | Normalización de placa (espacios/guiones) |
| C7 | Validaciones en sucursales |
| H-01 | **CRÍTICO**: `PUT /clientes/:id` — saldo/bloqueo solo admin |
| H-06 | **CRÍTICO**: `/notificaciones/enviar` requiere admin/supervisor |
| H-03 | `eliminarCliente(forzar)` recalcula puestos de reservas canceladas |
| H-05 | `actualizarReserva` valida `puestoAceptaTipo` |
| H-08b/H-09 | `recargarSaldo` transaccional + caja de sucursal |
| H9 | Ticket de entrada usa su propio folio (`ING-`), no el de la factura de salida |
| H1/H3/H5 | `generarFacturasPendientes` por saldo real + idempotente |
| H-02/H-16 | `refresh-token` con límite absoluto de 12 h |
| H-10 | Deuda del perfil corrige estado inexistente `"pagado"` |
| H-25 | `importarClientes` reporta placas duplicadas |

### Pruebas de regresión (nuevas)
- `backend/src/tests/integration/reglas-negocio.postgres.test.ts`: **5 pruebas** de A1 (vencimiento), compatibilidad puesto/vehículo, normalización de placa y puesto por sucursal.
- Suite total: **96/96 pruebas (19 archivos)**.
- `test:integration` ahora ejecuta toda la carpeta de integración.

### Verificación
- Typecheck backend: **OK**.
- Pruebas: **96/96**.
- Build frontend: **OK**.
- Migraciones locales: 22, base "up to date".

---

## 📐 Diseños listos (esperan aprobación, NO implementados)
- `docs-auditoria/DISENO-D1-D7-D10.md`: diseño funcional completo de:
  - **D1** Anulación de facturas con contrapartida + auditoría.
  - **D7** Clientes globales con visibilidad por sucursal.
  - **D10** Reservas con disponibilidad por fechas.
- `docs-auditoria/DECISIONES-NEGOCIO-PENDIENTES.md`: 11 decisiones + 8 hallazgos adicionales.

---

## ⏳ Pendiente — depende de tus decisiones de negocio
| # | Tema | Estado |
|---|---|---|
| D1 | Anulación de facturas | Diseño listo, espera aprobación |
| D4 | Puestos masivos multi-sucursal | Espera decisión |
| D5 | Intentos de login configurables | Espera decisión |
| D6 | Saldo del cliente (global/vehículo/sede) | Espera decisión |
| D7 | Clientes por sucursal | Diseño listo, espera aprobación |
| D8 | IVA | Espera decisión |
| D9 | Aforo global | Espera decisión |
| D10 | Reservas por fechas | Diseño listo, espera aprobación |
| D11 | Estado manual de puestos | Espera decisión |
| O7 | Tarifas activas duplicadas | Espera decisión |
| — | Entidad `Pago` | Espera decisión |
| — | Historial de propietarios | Espera decisión |
| — | Unificar renovaciones | Espera decisión |
| — | Recurrentes automáticos | Espera decisión |
| — | Columnas de arqueo en cierre de caja | Espera decisión |
| — | Pruebas E2E de backup/restauración | Espera autorización |

---

## 🚀 Publicación (push/deploy)
- **No realizado.** Pendiente de autorización explícita.
- Los 2 commits están en local. Producción (Neon/Render) sigue con el estado anterior.

---

## Resumen

- **Lo que se pudo cerrar sin decisiones de negocio: hecho y verificado** (20 correcciones + 5 pruebas de regresión, todo compilando y con 96/96 pruebas).
- **Lo que falta depende de tus decisiones** de negocio (D1, D4–D11, O7, Pago, propietarios, renovaciones, recurrentes, cierre, backup E2E).
- **Publicación**: sin hacer, esperando tu orden.

### Ruta propuesta para terminar el proyecto
1. Apruebas D1, D7, D10 (y subdecisiones) con el diseño ya entregado.
2. Se implementan esas 3 + las demás decisiones aprobadas, con migraciones.
3. Se amplían las pruebas (incluidas E2E de backup/restauración).
4. Auditoría final de resultados.
5. Autorizas push + despliegue.

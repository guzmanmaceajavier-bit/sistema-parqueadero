# AUDITORÍA INTEGRAL FINAL — Todo el sistema

> Auditoría completa (no solo los errores del commit `ad9c8c1`). Cubre todos los módulos, endpoints,
> permisos, procesos, reglas y relaciones. **Solo lectura** para el diagnóstico; se documenta también
> lo corregido tras la auditoría. No se tocó producción ni Neon.

**Reglas de negocio confirmadas** (asumidas como las recomendadas):
1. Plan vence dentro → cobrar **solo el excedente** desde el vencimiento.
2. Renovación anticipada → comienza **después del periodo vigente**.
3. Planes → **fijos o flexibles**.
4. Vence sin renovar → **libera reserva, nunca puesto ocupado**.

---

## 1. Resumen por clasificación

| Clasificación | Cantidad |
|---|---|
| Correcto y verificado | 14 áreas |
| Implementado sin pruebas suficientes | 9 |
| Parcialmente implementado | 7 |
| No implementado | 3 |
| Error confirmado | 13 |
| Requiere decisión del propietario | 11 |

---

## 2. ERRORES CONFIRMADOS (nuevos de esta auditoría) y su estado

| ID | Módulo | Descripción | Evidencia | Estado |
|---|---|---|---|---|
| H-01 | Clientes | **CRÍTICO**: `PUT /clientes/:id` sin rol; el schema acepta `saldo` y `bloqueado` → un empleado podía fijar saldo de cualquier cliente | `clientes.routes.ts:74`, `cliente.schema.ts:17-20` | **CORREGIDO** (saldo/bloqueado solo admin) |
| H-06 | Notificaciones | `POST /notificaciones/enviar` solo `verificarToken` → cualquier empleado envía push arbitrarios a todos | `notificaciones.routes.ts:6` | **CORREGIDO** (admin/supervisor) |
| H-03 | Clientes | `eliminarCliente(forzar)` liberaba puestos solo de mensualidades; los de **reservas canceladas** quedaban RESERVADO para siempre | `clientes.controller.ts:225-240` | **CORREGIDO** (recalcula mensualidades + reservas) |
| H-05 | Reservas | `actualizarReserva` no revalidaba `puestoAceptaTipo` → puesto incompatible por API | `reservas.controller.ts:229-234` | **CORREGIDO** |
| H-08b | Clientes/Caja | `recargarSaldo` no transaccional + caja sin sucursal → saldo acreditado sin ingreso o en caja de otra sede | `clientes.controller.ts:344` | **CORREGIDO** (transacción + sucursal) |
| H-25 | Clientes | `importarClientes` silenciaba placas duplicadas (cliente sin vehículo, sin aviso) | `clientes.controller.ts:411` | **CORREGIDO** (reporta el error) |
| H-10 | Clientes | `perfilCliente` comparaba estado inexistente `"pagado"` → deuda incluía mensualidades CANCELADAS | `clientes.controller.ts:299` | **CORREGIDO** |
| H9 | Ingresos | `ticketEntrada` usaba el número de la **factura de salida** como folio de entrada | `ingresos.controller.ts:890-900` | **CORREGIDO** (folio `ING-`) |
| H1/H3 (caja) | Mensualidades | `generarFacturasPendientes` emitía por valor total (no saldo) y podía duplicar por concurrencia | `mensualidades.controller.ts:668-705` | **CORREGIDO** (saldo real + lock idempotente) |
| H-02/H-16 | Usuarios | `refresh-token` con `ignoreExpiration` sin límite absoluto → sesión eterna | `usuarios.controller.ts:315` | **CORREGIDO** (máx 12 h) |
| H-04 | Puestos | `crearPuestosMasivos`/schema descartan `sucursalId`; `@@unique([sucursalId,codigo])` no detecta duplicados con NULL | `puestos.controller.ts:44`, `puesto.schema.ts` | **REQUIERE DECISIÓN** (ver §5) |
| H-12 | Usuarios | `intentosMaximos` de configuración no gobierna el bloqueo real (hardcoded 5/15 min) | `usuarios.controller.ts:36-38` | **REQUIERE DECISIÓN** |
| O7 | Tarifas | Si hay varias tarifas activas iguales para tipo+modalidad, toma la más barata en silencio | `calculadorCobros.ts:69` | **REQUIERE DECISIÓN** |

---

## 3. Correcto y verificado (sin cambios)

- Autenticación: JWT httpOnly, `tokenVersion` contra BD, bloqueo por intentos, logout invalida.
- Protección del último admin (desactivar/degradar/eliminar) con advisory lock `78124022`.
- Aislamiento multi-sucursal en puestos, reservas, mensualidades, ingresos, vehículos, ausencias (`resolverSucursalPermitida`, fail-closed).
- Cálculo de cobros (modalidades, cortesía, progresiva, tope, ticket extraviado) — con pruebas.
- Concurrencia de entrada/salida/caja/recurrentes con advisory locks y `updateMany` condicional — con pruebas de integración.
- Caja: una abierta por sucursal, cierre con arqueo, movimientos anulados excluidos de totales.
- Máquina de estados de Reserva (transiciones válidas, sin finalizar con ingreso activo).
- Eliminación con historial: puesto (409 con historial), ingreso/mensualidad (400/409 con facturas), usuario (409 con cajas/accesos), cliente (retiro lógico).
- Normalización de placa (C6) y validaciones de sucursal (C7) — implementadas en la fase previa.
- `calcularPagadoMensualidad` filtra `metodoPago != null` (correcto).

---

## 4. Parcialmente implementado / sin pruebas suficientes

| Tema | Estado | Nota |
|---|---|---|
| Anulación de factura con contrapartida | **No implementado** | No hay campo `anulada` ni endpoint; un cobro erróneo no se puede corregir (solo se anula el movimiento si no tiene factura). |
| Entidad `Pago` independiente | **No implementado** | Abonos = `Factura` con `metodoPago`. Trazabilidad limitada. |
| Historial de propietarios de vehículo | **No implementado** | `Vehiculo.clienteId` se sobreescribe. |
| Duplicación `Vehiculo.planId` vs `Mensualidad.planId` | Parcial | Fuente de verdad = Mensualidad; el campo del vehículo puede quedar desactualizado. |
| Filtro de sucursal en ausencia EXTENDER/DESCONTAR | Parcial | Ramas sin `sucursalId` (impacto bajo, 1 vehículo = 1 sede). |
| `cobrarMensualidad` renueva el mismo registro reescribiendo `fechaInicio` | Parcial | Rompe el vínculo período↔factura; `renovarMensualidad` sí crea registro nuevo. |
| Recurrentes de gastos no se ejecutan solos | Parcial | El scheduler no llama `generarRecurrentes`. |
| Cierre de caja guarda "esperado" no "conteo" | Parcial | La diferencia queda en `observacion` (texto). |
| Pruebas E2E de backup/restauración | Sin cobertura | No ejecutadas (destructivas). |
| IVA (`config.iva`) | No aplicado | El campo existe; `calculadorCobros` no lo usa. |
| Aforo global | No implementado | La capacidad es por puesto, no del parqueadero. |

---

## 5. REQUIERE DECISIÓN DEL PROPIETARIO

| # | Tema | Pregunta |
|---|---|---|
| D1 | Anulación de facturas | ¿Se permite anular una factura y su movimiento con auditoría? |
| D2 | Cobro de plan vencido | Confirmado: solo excedente (ya implementado). |
| D3 | Interés de sesión (refresh) | Confirmado: máx 12 h (ya implementado). |
| D4 | Puestos masivos multi-sucursal | Debe permitirse fijar `sucursalId` en la creación masiva (hoy se descarta). |
| D5 | Repetición de intentos de login | ¿`intentosMaximos` de config debe gobernar el bloqueo? |
| D6 | Saldo del cliente | ¿Cuenta corriente global por cliente (hoy) o por vehículo? |
| D7 | Clientes globales vs por sucursal | `Cliente` no tiene `sucursalId`; empleados ven PII de todos. |
| D8 | IVA | ¿Aplica a las facturas? |
| D9 | Aforo global | ¿Capacidad máxima del parqueadero? |
| D10 | Reserva crea RESERVADO inmediato | ¿Debe reservar el puesto desde la creación aunque sea a meses vista? |
| D11 | Estado de puesto manual | `PUT /puestos/:id` acepta OCUPADO/RESERVADO/AUSENCIA manualmente (rompe el invariante derivado). |

---

## 6. Pruebas ejecutadas

- `typecheck` backend: **OK**.
- `npm test` backend: **91/91** (18 archivos).
- `build` frontend: **OK**.
- Sin pruebas automatizadas nuevas todavía para los 9 escenarios que pediste (A1, A2, A3, scheduler doble, puesto fijo, snapshot de factura, mismo código en dos sedes, permisos por API). **Pendiente** — recomendado como fase siguiente.

---

## 7. Veredicto para producción

**No desplegar todavía.** Motivos:
1. Faltan las pruebas de regresión de los escenarios críticos.
2. Hay 11 decisiones de negocio abiertas (algunas afectan diseño, como anulación de facturas y clientes por sucursal).
3. Persisten 3 funcionalidades ausentes con impacto contable (anulación de factura, entidad Pago, historial de propietarios).

**Lo corregido en esta auditoría** (10 hallazgos confirmados, incluido 1 crítico de permisos) reduce el riesgo considerablemente, pero el sistema aún necesita la capa de pruebas y las decisiones para considerarse "listo para un parqueadero real con varias sedes".

### Orden recomendado
1. Decisiones de negocio (sección 5).
2. Anulación de factura + entidad Pago (impacto contable).
3. Pruebas de regresión de A1/A2/A3/B1/B2/B3 + los 8 escenarios del solicitante.
4. Puestos masivos multi-sucursal (D4) y estado de puesto derivado (D11).
5. Pruebas E2E de backup/restauración.

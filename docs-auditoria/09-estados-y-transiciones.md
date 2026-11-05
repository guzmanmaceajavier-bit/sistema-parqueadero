# 09 — Estados y transiciones

> Los estados se almacenan como `String` (no enums Prisma). Definidos por convención en controladores/servicios.

## 1. Vehículo
Campos: `estado` (bool), `bloqueado` (bool), `tipoCobro` (PLAN/TARIFA/NINGUNO).

```mermaid
stateDiagram-v2
  [*] --> Activo: crearVehiculo
  Activo --> Suspendido: eliminarVehiculo (con historial)
  Activo --> Bloqueado: bloqueado=true (edición)
  Bloqueado --> Activo: bloqueado=false
  Suspendido --> Activo: edición manual
```
| Transición | Quién | Restricción |
|---|---|---|
| crear → estado true | admin/supervisor | placa única |
| activo → suspendido (estado false) | admin al eliminar | si tiene ingresos/mensualidades/reservas/ausencias |
| bloqueado ⇄ activo | admin/supervisor (edición) | vehículo bloqueado no puede ingresar |

## 2. Ingreso
```mermaid
stateDiagram-v2
  [*] --> ACTIVO: registrarIngreso
  ACTIVO --> FINALIZADO: salida-con-cobro / liberar
  FINALIZADO --> [*]: eliminarIngreso (si sin facturas)
```
| Transición | Quién | Restricción |
|---|---|---|
| crear → ACTIVO | admin/supervisor | cliente/vehículo válidos; vehículo no dentro; puesto disponible |
| ACTIVO → FINALIZADO | admin/supervisor | salida con cobro o liberar (con plan); revalida cobertura |
| FINALIZADO → eliminado | admin | solo si NO tiene facturas |

## 3. Puesto
```mermaid
stateDiagram-v2
  [*] --> LIBRE: crearPuesto
  LIBRE --> OCUPADO: ingreso / mensualidad vigente
  LIBRE --> RESERVADO: reserva / mensualidad futura
  RESERVADO --> OCUPADO: activar reserva / ingreso
  OCUPADO --> RESERVADO: salida con plan/reserva futura
  OCUPADO --> LIBRE: salida sin plan ni reserva
  RESERVADO --> LIBRE: cancelar reserva/mensualidad
  LIBRE --> MANTENIMIENTO: actualizarPuesto
  MANTENIMIENTO --> LIBRE: actualizarPuesto
  OCUPADO --> AUSENCIA: crearAusencia (con ingreso)
  AUSENCIA --> LIBRE: finalizarAusencia
```
| Transición | Quién | Restricción |
|---|---|---|
| → OCUPADO | sistema (ingreso/mensualidad) | no desde el endpoint de puestos |
| → LIBRE/MANTENIMIENTO | admin/supervisor | solo si sin ingresos/mensualidades/reservas activas |
| → RESERVADO | reserva/mensualidad futura | |
| → AUSENCIA | ausencia con ingreso | |

## 4. Plan
`activo` (bool). Crear → activo. DELETE desactiva si hay mensualidades activas; borra si no hay ninguna. Editar activa/desactiva.

## 5. Reserva
```mermaid
stateDiagram-v2
  [*] --> PENDIENTE: crearReserva
  PENDIENTE --> CONFIRMADA: cambiarEstado
  PENDIENTE --> CANCELADA: cancelar / vencida
  CONFIRMADA --> ACTIVA: cambiarEstado (crea ingreso)
  CONFIRMADA --> NO_SHOW: vencida (scheduler)
  ACTIVA --> FINALIZADA: tras salida
  ACTIVA --> CANCELADA: (bloqueado si ya generó ingreso)
  PENDIENTE --> CANCELADA: eliminar/cancelar
```
Restricción clave: activar requiere puesto + vehículo; cancelar una reserva con ingreso generado se bloquea.

## 6. Factura
No tiene campo `estado`; su "estado de pago" se deriva de `metodoPago` (null = PENDIENTE, valor = PAGADA). Origen: INGRESO / MENSUALIDAD / MENSUALIDAD_AUTO.

## 7. Pago
Modelado como `Factura` + `CajaMovimiento`. No hay entidad `Pago`. Los abonos de suscripción generan varias facturas `FACT-MEN`.

## 8. Caja
```mermaid
stateDiagram-v2
  [*] --> ABIERTA: abrirCaja (contraseña)
  ABIERTA --> CERRADA: cerrarCaja (arqueo)
  CERRADA --> [*]: inmutable (no editable/eliminable)
```
| Transición | Quién | Restricción |
|---|---|---|
| → ABIERTA | admin/supervisor | una por sucursal; contraseña válida |
| ABIERTA → CERRADA | admin/supervisor | conteo de denominaciones válido |
| CERRADA → nada | — | inmutable |

**CajaMovimiento**: `anulado` false → true (soft-delete con `anuladoEn/Por/motivo`); nunca se borra.

## 9. Usuario
`estado` (bool) + `bloqueadoHasta` + `tokenVersion`.
```mermaid
stateDiagram-v2
  [*] --> Activo: crearUsuario
  Activo --> Bloqueado: 5 intentos fallidos (15 min)
  Bloqueado --> Activo: login exitoso
  Activo --> Inactivo: cambiarEstado(false)
  Inactivo --> Activo: cambiarEstado(true)
```
Cualquier cambio de privilegios incrementa `tokenVersion` (invalida sesiones). Protecciones: no desactivar/eliminar el último admin activo.

## 10. Mensualidad
```mermaid
stateDiagram-v2
  [*] --> ACTIVA: crearMensualidad
  ACTIVA --> VENCIDA: scheduler (fechaFin pasada) / actualización
  ACTIVA --> CANCELADA: cancelarMensualidad
  VENCIDA --> ACTIVA: renovación/cobro
  VENCIDA --> CANCELADA: cancelar
  /* eliminar: solo VENCIDA/CANCELADA sin facturas */
```

## 11. Ausencia
`ACTIVA` → `FINALIZADA` (finalizar aplica opción sobre la mensualidad). `opcion`: HISTORIAL/EXTENDER/DESCONTAR/CONGELAR/MANTENER.

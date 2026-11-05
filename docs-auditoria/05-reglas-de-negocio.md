# 05 — Reglas de negocio

> Clasificación: **(A)** implementada · **(B)** parcialmente implementada · **(C)** no existe · **(D)** comportamiento indeterminable.
> Cada regla cita la evidencia en código.

---

## CLIENTES Y VEHÍCULOS

| # | Regla | Clase | Evidencia / notas |
|---|---|---|---|
| C1 | Documento de cliente único | A | `clientes.controller.ts` (`findUnique({documento})`) |
| C2 | Un cliente puede tener varios vehículos | A | relación `Cliente 1—N Vehiculo` (`schema.prisma`) |
| C3 | Placa única global | A | `vehiculos.controller.ts` `@unique placa` |
| C4 | Un vehículo pertenece a un solo cliente | A | `Vehiculo.clienteId` obligatorio |
| C5 | Cambio de propietario conserva historial | **C** | se sobreescribe `clienteId`; no hay tabla de propietarios históricos |
| C6 | Cliente con vehículo dentro no se puede retirar | A | `clientes.controller.ts` (400) |
| C7 | Retirar cliente con mensualidades/reservas: cancela con `forzar` | A | `eliminarCliente` transacción |
| C8 | Vehículo con historial se suspende, no se borra | A | `vehiculos.controller.ts` (estado:false) |
| C9 | Cliente bloqueado no puede ingresar | A | `ingresos.controller.ts` (400) |
| C10 | Saldo de cliente se descuenta al salir | A | `registrarSalidaConCobro` (FOR UPDATE) |
| C11 | Historial de cambios de estado del cliente | **C** | no se registra historial; solo estado actual |

## PLANES

| # | Regla | Clase | Evidencia / notas |
|---|---|---|---|
| P1 | Plan define duración (días) y valor | A | `schema.prisma` `Plan.duracionDias/valor` |
| P2 | Planes semanal/quincenal/mensual | A | `duracionDias` libre (1,15,30…); UI ofrece Diario/Semanal/Quincenal/Mensual/Otro |
| P3 | Plan da puesto fijo (opcional) | A | `Mensualidad.puestoId` |
| P4 | Renovación conserva historial (crea nueva mensualidad) | A | `renovarMensualidad` |
| P5 | Renovación usa aritmética sin desborde de fin de mes | A | `utils/fechas.ts` `sumarMesesConTope` |
| P6 | Vencimiento automático | A | `scheduler.ts` (cada 10 min) |
| P7 | Cobro del plan (abonos) | A | `cobrarMensualidad` |
| P8 | Al saldar, renueva automáticamente por `plan.duracionDias` | A | `cobrarMensualidad` (fallback 30) |
| P9 | Beneficios: entrada/salida sin cobro con plan vigente | A | `registrarSalidaConCobro` / `liberarPuesto` |
| P10 | Un vehículo no puede tener mensualidades solapadas | A | `crearMensualidad` (locks) |
| P11 | Un puesto no puede tener dos mensualidades solapadas | A | `crearMensualidad` |
| P12 | Plan vencido mientras el vehículo está dentro | **B** | el scheduler marca VENCIDA y recalcula puesto, pero **el ingreso activo de ese vehículo no se cierra ni se convierte a cobro**; queda ACTIVO con puesto posiblemente liberado → ver documento 10 (inconsistencia) |
| P13 | Renovación anticipada | A | `renovarMensualidad` (inicia después de `fechaFin`) |
| P14 | Cambio de vehículo asociado al plan | A | `actualizarMensualidad` (prohibido con facturas/ingreso activo) |

## PUESTOS

| # | Regla | Clase | Evidencia / notas |
|---|---|---|---|
| S1 | Estados: LIBRE, OCUPADO, RESERVADO, MANTENIMIENTO, AUSENCIA | A | `puesto.constants.ts`, controladores |
| S2 | Puesto único por código | A | `@unique codigo` |
| S3 | No liberar con ingresos/mensualidades/reservas activas | A | `puestos.controller.ts` |
| S4 | No eliminar puesto con historial | A | `puestos.controller.ts` (409) |
| S5 | Recalcular estado tras cada operación | A | múltiples controladores + scheduler |
| S6 | Puesto de mantenimiento no asignable | A | `crearMensualidad`, `crearIngreso` (validación de estado) |
| S7 | Disponibilidad depende del tipo de vehículo | **B** | `PuestoAssignModal` valida tipo (frontend); el **backend no** valida `tipoPuesto` vs `tipo` de vehículo al crear ingreso → un carro podría ocupar un puesto de moto por API |
| S8 | Zona del puesto | A | campo `zona`, filtros en UI |

## INGRESOS Y SALIDAS

| # | Regla | Clase | Evidencia / notas |
|---|---|---|---|
| I1 | Un vehículo no puede tener dos ingresos ACTIVO | A | `registrarIngreso` (400/409) |
| I2 | Puesto no se ocupa dos veces | A | advisory lock + `updateMany` condicional |
| I3 | Ingreso con reserva usa el puesto reservado | A | `registrarIngreso` (409 si difiere) |
| I4 | Ingreso con plan usa el puesto del plan | A | `registrarIngreso` |
| I5 | Salida con plan vigente no cobra | A | `registrarSalidaConCobro` |
| I6 | Salida con plan deja puesto RESERVADO (si plan/puesto futuro) o LIBRE | A | recálculo de estado |
| I7 | Salida duplicada rechazada | A | `updateMany where estado ACTIVO` + conteo |
| I8 | No eliminar ingreso ACTIVO | A | 400 |
| I9 | No eliminar ingreso con facturas | A | 409 |
| I10 | Cortesía (minutos) | A | `calculadorCobros.ts` |
| I11 | Ticket extraviado cobra tarifa máxima diaria | A | `calculadorCobros.ts` (exige `tarifaMaximaDiaria`) |
| I12 | Edición de ingreso de reserva prohibida | A | `actualizarIngreso` (409) |
| I13 | Reingreso recupera el mismo puesto (plan/reserva) | A | `registrarIngreso` fija puesto del plan |
| I14 | Tiempo de permanencia | A | `tiempoMinutos` calculado |
| I15 | Doble salida concurrente | A | lock + `updateMany` (probado en `ingresos.postgres.test.ts`) |

## CAJA

| # | Regla | Clase | Evidencia / notas |
|---|---|---|---|
| K1 | Una caja ABIERTA por sucursal | A | `abrirCaja` (advisory lock 78124019) |
| K2 | Apertura con contraseña | A | bcrypt compare |
| K3 | Cierre con arqueo de denominaciones COP | A | `cerrarCaja` |
| K4 | `esperado = apertura + ingresosEfectivo − egresosEfectivo` | A | `cerrarCaja` |
| K5 | Cajas cerradas inmutables y no eliminables | A | `actualizarCaja`, `eliminarCaja` |
| K6 | Movimientos de caja cerrada no editables/anulables | A | controladores |
| K7 | Movimientos de factura/gasto se corrigen desde su origen | A | controladores |
| K8 | Anulación = soft-delete con auditoría | A | `anulado`, `anuladoEn/Por/motivo` |
| K9 | Fondo de apertura editable solo sin movimientos | A | `actualizarCaja` |
| K10 | Un cierre no puede coincidir con operaciones en curso | A | lock global compartido |

## TARIFAS

| # | Regla | Clase | Evidencia / notas |
|---|---|---|---|
| T1 | Modalidades: minuto, hora, diario, semanal, quincenal, mensual | A | `calculadorCobros.ts` |
| T2 | Cobro progresivo (primera hora + adicional) | A | `calculadorCobros.ts` |
| T3 | Tope diario (`tarifaMaximaDiaria`) | A | `calculadorCobros.ts` |
| T4 | Cortesía / minutos gratis / gracia | A | `calculadorCobros.ts` |
| T5 | Tarifa por tipo de vehículo (exacta o "todos") | A | prioriza coincidencia exacta |
| T6 | Tarifa asignada a vehículo tiene prioridad | A | `calcularCobro({tarifaId})` |
| T7 | Modalidad desconocida se rechaza (no cae a hora) | A | error explícito |
| T8 | Cambio de tarifa con vehículos estacionados | **B** | no hay bloqueo; el cobro se recalcula con la tarifa vigente al momento de la salida (puede diferir de la mostrada al ingresar). Documentar política |
| T9 | Tarifa única (no hay historial de valores por tarifa) | **C** | las facturas no referencian `tarifaId`; el importe queda fijado en la factura |

## Observaciones generales

- Las reglas de integridad financiera (no borrar con facturas, cajas cerradas inmutables, auditoría) están **bien implementadas**.
- Las reglas de **negocio comercial** con más ambigüedad (multi-propietario histórico, tipo de puesto vs tipo de vehículo en backend, cambio de tarifa en caliente, plan vencido con vehículo dentro) son las que requieren definición (documento 12).

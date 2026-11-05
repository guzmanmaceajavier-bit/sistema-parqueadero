# SEGUNDA AUDITORÍA — Integridad y coherencia del negocio

> Auditoría funcional exhaustiva basada en lectura directa del código (no solo de la documentación).
> **No se modificó ningún archivo.** Se distingue: **ERROR CONFIRMADO** (verificado en código), **RIESGO** (depende de combinación de estados no cubierta) y **DECISIÓN DE NEGOCIO PENDIENTE**.
> Cuando algo no pudo comprobarse ejecutando, se marca **NO VERIFICADO**.

**Principio rector del negocio** (aportado por el solicitante, usado como referencia):
> La **mensualidad** determina el derecho a estacionar sin pagar por estancia. El **ingreso** determina si el vehículo está físicamente dentro. El **puesto** determina dónde está estacionado o qué espacio tiene reservado. Son tres conceptos distintos.

---

# A. HALLAZGOS CRÍTICOS

## A1 — Mensualidad vence con el vehículo dentro: el ingreso queda "colgado" y el puesto puede reasignarse · **ERROR CONFIRMADO**
- **Evidencia**:
  - `services/scheduler.ts` → `vencerMensualidades()` (líneas 74-109): marca la mensualidad `VENCIDA` y recalcula el puesto a `LIBRE`/`RESERVADO` **sin tocar el `Ingreso`** de ese vehículo.
  - `modules/ingresos/ingresos.controller.ts` → `registrarSalidaConCobro` (líneas 592-603): busca `mensualidadVigente` con `fechaFin >= ahora`. Si ya venció, **no la encuentra** → `cubiertoPorPlan = false` → cobra por tarifa.
- **Entidades**: Mensualidad, Ingreso, Puesto, Factura, Caja.
- **Proceso afectado**: vencimiento automático (cron cada 10 min) + salida.
- **Ejemplo práctico**: cliente con mensualidad que vence a las 00:00; el vehículo entra el día 30 y sigue dentro el día 31. A las 00:10 el scheduler marca VENCIDA y libera el puesto. Otro vehículo ocupa ese puesto físicamente. Al salir el primer vehículo, se le cobra tarifa por hora desde la entrada (no solo el excedente).
- **Consecuencia**: **doble ocupación del mismo puesto** (inconsistencia física) y **cobro potencialmente incorrecto** (por tiempo completo en lugar de excedente o plan).
- **Solución propuesta**: (1) al vencer una mensualidad con ingreso activo, **no liberar el puesto** (mantenerlo OCUPADO hasta la salida real); (2) definir política de cobro del excedente. Requiere decisión de negocio (ver D1).
- **Prueba necesaria**: integración PostgreSQL — crear ingreso cubierto por plan, avanzar `fechaFin`, ejecutar `vencerMensualidades()`, verificar que el puesto **no** se libera y que el ingreso sigue coherente.

## A2 — Renovación (`cobrarMensualidad`) y renovación (`renovarMensualidad`) pueden solaparse o duplicar período · **RIESGO**
- **Evidencia**:
  - `cobrarMensualidad` (líneas 608-618): al saldar el saldo, **renueva la MISMA mensualidad** (`fechaInicio=now`, `fechaFin=now+duracionDias`).
  - `renovarMensualidad` (líneas 200-294): **crea una NUEVA mensualidad** con `fechaInicio = max(fechaFin, ahora)+1`, conservando la anterior.
  - Ambas rutas existen y son independientes. `cobrarMensualidad` usa el lock `78124018` (por mensualidad); `renovarMensualidad` usa locks de vehículo/puesto (`78124021/20`) — **locks distintos**.
- **Entidades**: Mensualidad, Factura, Caja, Cliente (saldo).
- **Ejemplo práctico**: un empleado cobra el saldo (dispara renovación en la misma mensualidad) y, en paralelo, otro pulsa "Renovar". El lock de cobro no bloquea la creación de la nueva mensualidad → pueden quedar **dos períodos activos** para el mismo vehículo/puesto.
- **Consecuencia**: doble cobertura, doble reserva de puesto, cobros duplicados.
- **Solución propuesta**: unificar el modelo de renovación (una sola vía) o hacer que ambas adquieran el mismo lock por vehículo; añadir constraint/verificación de solapamiento.
- **Prueba**: concurrencia — `cobrarMensualidad` + `renovarMensualidad` simultáneos sobre el mismo vehículo → debe quedar **un** período activo.

## A3 — `Ausencia` finaliza el ingreso cobrando **siempre por tarifa**, sin considerar el plan vigente · **ERROR CONFIRMADO**
- **Evidencia**: `modules/ausencias/ausencias.controller.ts` → `crearAusencia` (líneas 39-72): si hay ingreso activo, calcula `horas * tarifa.valor` y **crea factura con ese valor** aunque el vehículo tenga mensualidad vigente. No consulta `Mensualidad`.
- **Entidades**: Ausencia, Ingreso, Factura, Tarifa, Mensualidad, Caja.
- **Ejemplo práctico**: cliente con plan mensual con puesto fijo registra "ausencia"; el sistema le cobra la estancia como si fuera ocasional.
- **Consecuencia**: **cobro indebido** a un cliente con plan; además deja el ingreso FINALIZADO con valor pagado.
- **Solución propuesta**: verificar cobertura de mensualidad antes de facturar (igual que `registrarSalidaConCobro`); si hay plan, cobro 0.
- **Prueba**: crear mensualidad vigente + ingreso + ausencia → la factura debe ser 0 o no existir.

## A4 — El `Ingreso.clienteId` puede no coincidir con el propietario del vehículo · **ERROR CONFIRMADO (parcial)**
- **Evidencia**: `registrarIngreso` sí valida `vehiculo.clienteId === clienteId` (línea 68). **Pero** `actualizarIngreso` (líneas 345-470) permite cambiar `vehiculoId` validando que el vehículo pertenezca al **cliente del ingreso** (línea 372), no al revés. Y `eliminarCliente`/cambio de propietario de vehículo no reconcilian ingresos históricos.
- **Además**: si en el futuro se cambia `Vehiculo.clienteId` (cambio de propietario), los `Ingreso` anteriores conservan su `clienteId` — lo cual es **correcto para el historial**, pero **no existe entidad de propietarios** que documente la transición.
- **Entidades**: Cliente, Vehiculo, Ingreso.
- **Consecuencia**: no se rompe el historial, pero **no hay trazabilidad** de quién era el propietario; y no hay validación de que el nuevo ingreso use al propietario actual si el vehículo cambió de dueño.
- **Solución propuesta**: entidad `VehiculoPropietario` (o `Vehiculo.clienteId` + histórico) y validación explícita.
- **Prueba**: cambiar propietario y verificar que ingresos previos conservan su cliente y que un ingreso nuevo usa el propietario actual.

## A5 — No existe entidad `Pago`; abonos y saldos se modelan con `Factura` · **DECISIÓN/RIESGO**
- **Evidencia**: `schema.prisma` no tiene modelo `Pago`; los abonos son filas de `Factura` (`origen=MENSUALIDAD`) con `metodoPago`. El saldo pendiente se calcula sumando facturas del período (`utils/saldos.ts`).
- **Riesgo**: no se puede distinguir con precisión "una factura", "un pago parcial" y "la aplicación del pago a una deuda"; anular una factura mezcla conceptos.
- **Consecuencia**: trazabilidad financiera limitada; conciliación más difícil.
- **Solución propuesta**: evaluar entidad `Pago` (con `facturaId`, `monto`, `metodoPago`, `fecha`) y `Factura` como documento. No es obligatorio si el negocio lo acepta.

---

# B. HALLAZGOS ALTOS

## B1 — Tipo de puesto vs tipo de vehículo NO se valida en backend · **ERROR CONFIRMADO**
- **Evidencia**: `registrarIngreso` no compara `Puesto.tipoPuesto` con `Vehiculo.tipo`. La validación existe solo en `frontend/src/components/puestos/PuestoAssignModal.tsx`.
- **Consecuencia**: por API, un carro puede ocupar un puesto de moto.
- **Solución/Prueba**: validar en backend (`tipoPuesto` es multi-valor separado por comas) + prueba de API con carro→puesto-moto (debe rechazar).

## B2 — Cambio de tarifa en caliente (no hay snapshot al ingreso) · **DECISIÓN PENDIENTE**
- **Evidencia**: `calculadorCobros.ts` lee la tarifa vigente y `activa` al momento del **cobro (salida)**. `Ingreso` no guarda `tarifaId` ni monto estimado.
- **Consecuencia**: el precio informado al entrar puede diferir del cobrado; si una tarifa se desactiva antes de la salida y no hay `tarifaId` en el vehículo, la salida puede fallar ("No hay tarifa activa…").
- **Solución propuesta**: definir política (congelar tarifa al ingreso o usar tarifa vigente al salir) y, si se congela, guardar snapshot en `Ingreso`.
- **Prueba**: editar tarifa con vehículo dentro y verificar el importe cobrado según la política elegida.

## B3 — Puesto con código único **global**, incompatible con multi-sucursal · **ERROR CONFIRMADO**
- **Evidencia**: `schema.prisma` `Puesto.codigo @unique` (global). Existe `Sucursal`.
- **Consecuencia**: no se puede tener el puesto `P-01` en la sucursal A y otro `P-01` en la sucursal B.
- **Solución propuesta**: cambiar la unicidad a compuesta `@@unique([sucursalId, codigo])`. (No ejecutar migración sin aprobación.)

## B4 — `Mensualidad.puestoId = null` cubre "cualquier puesto" · **RIESGO / DECISIÓN**
- **Evidencia**: en `registrarSalidaConCobro` y `liberarPuesto` la cobertura usa `OR: [{puestoId:null}, {puestoId: ingreso.puestoId}]`. En `registrarIngreso`, el plan solo fija puesto si `planDetectado.puestoId` no es nulo; un plan flexible no fija puesto.
- **Consecuencia**: un plan sin puesto fijo cubre la estancia en cualquier puesto (correcto), pero **no hay garantía explícita** de que no se "apropie" de un puesto reservado a otro: al ingresar, `puestoEstaDisponibleParaAsignar` cuenta reservas ajenas y las bloquea, lo que mitiga. **Riesgo bajo** pero conviene prueba específica.
- **Prueba**: plan flexible + puesto RESERVADO para otro → no debe poder ocuparlo.

## B5 — Ausencia: `EXTENDER` no filtra por sucursal · **ERROR CONFIRMADO (menor)**
- **Evidencia**: `finalizarAusencia` líneas 186-204: las ramas `EXTENDER`, `DESCONTAR`, `MANTENER` buscan mensualidades con `where: { vehiculoId }` **sin** `sucursalId` (la rama `CONGELAR` sí lo incluye). Inconsistencia interna.
- **Consecuencia**: en multi-sucursal, podría modificar la mensualidad de otra sede del mismo vehículo (si existiera). Hoy un vehículo pertenece a una sola sucursal, por lo que el impacto es bajo.
- **Solución**: uniformar el filtro por sucursal.

## B6 — Salida sin caja abierta o caja de otra sucursal · **ERROR CONFIRMADO (validado)**
- **Evidencia**: `registrarSalidaConCobro` exige `getCajaOError()` y crea movimiento en la caja abierta de la sucursal del vehículo; si no hay, lanza 400. ✔ **Correcto**. Se documenta como confirmado-correcto.
- **Nota**: para un vehículo **sin sucursal** (`sucursalId=null`), se usa la caja de `sucursalId=null`; si el operador tiene sucursal asignada, podría no encontrarla. Riesgo de UX (ver D-sucursal).
- **Prueba**: salida de vehículo sin sucursal con caja abierta global.

## B7 — `formatearSistema` puede dejar estado parcial · **ERROR CONFIRMADO**
- **Evidencia**: `configuracion.controller.ts` itera `deleteMany` con `try/catch` que **ignora** errores por modelo.
- **Consecuencia**: un borrado parcial se reporta como exitoso.
- **Solución**: acumular errores y reportarlos; idealmente transacción única.

## B8 — Permisos de UI vs API inconsistentes · **ERROR CONFIRMADO (UX/seguridad)**
- **Evidencia**: `/tarifas` y `/planes` sin guard de rol en `AppRouter.tsx` (la API exige admin); botones "Eliminar" visibles a empleado en varias páginas.
- **Consecuencia**: 403 confusos; superficie visible.
- **Solución**: `allowedRoles` en frontend y ocultar acciones destructivas.

## B9 — Múltiples mensualidades activas: protegido por lógica, **no por restricción de BD** · **RIESGO**
- **Evidencia**: `crearMensualidad` y `renovarMensualidad` validan solapamiento con queries + locks (`78124021/20`), pero no hay `@@unique` que lo garantice a nivel de datos.
- **Consecuencia**: bajo concurrencia extrema o rutas con locks distintos (ver A2), podrían coexistir dos mensualidades.
- **Solución**: además de la lógica, evaluar índice único parcial o constraint de exclusión (PostgreSQL `EXCLUDE USING gist` con rangos de fecha).

---

# C. HALLAZGOS MEDIOS

## C1 — `Ingreso` no guarda la tarifa ni el desglose aplicado · **ERROR CONFIRMADO**
- **Evidencia**: `Ingreso` solo guarda `tiempoMinutos` y `valorPagado`; `Factura` no guarda modalidad/minutos/descuentos.
- **Consecuencia**: no se puede reconstruir el cálculo (cortesía, progresiva, tope) desde la factura.
- **Solución**: guardar snapshot del cálculo.

## C2 — `Vehiculo.planId`/`tipoCobro` vs `Mensualidad.planId`: información duplicada · **RIESGO**
- **Evidencia**: el vehículo tiene `planId`/`tipoCobro`/`creadoPorPlan`; la mensualidad tiene su propio `planId`. La fuente de verdad de la **cobertura vigente** es la `Mensualidad` (así la usa `registrarIngreso`/`salida`), mientras `Vehiculo.planId` es "el plan por defecto del vehículo".
- **Riesgo**: pueden quedar descoordinados (vehículo apunta a un plan, mensualidad a otro). No rompe cobro (manda mensualidad), pero confunde.
- **Solución**: documentar/centralizar la fuente de verdad o eliminar la duplicación.

## C3 — `Puesto` puede quedar RESERVADO y a la vez sin reserva vigente (dependencia del recálculo) · **RIESGO**
- **Evidencia**: el estado del puesto se recalcula tras cada operación; si alguna ruta no recalcula (p. ej. `actualizarMensualidad` en ciertos caminos), el estado podría quedar desincronizado.
- **Solución**: centralizar el recálculo del puesto en un helper único.

## C4 — `actualizarIngreso` permite mover vehículo/puesto de un ingreso activo · **RIESGO**
- **Evidencia**: `actualizarIngreso` (líneas 345-470) permite cambiar `vehiculoId`/`puestoId` si no viene de reserva.
- **Consecuencia**: altera la trazabilidad de una estancia en curso.
- **Solución**: definir si debe permitirse.

## C5 — `eliminarIngreso` no valida caja cerrada · **ERROR CONFIRMADO**
- **Evidencia**: bloquea si tiene facturas (409), pero si el ingreso no tiene facturas y la caja está cerrada, podría eliminarse un registro operativo. (Bajo riesgo porque sin factura no hay impacto contable.)
- **Solución**: uniformar con el criterio de "historial protegido".

## C6 — Validación de placa: no normaliza espacios/guiones · **ERROR CONFIRMADO (menor)**
- **Evidencia**: `crearVehiculo` hace `placa.toUpperCase().trim()` pero **no** elimina espacios internos ni guiones. `ABC-123` y `ABC123` serían placas distintas.
- **Solución**: normalizar (quitar espacios/guiones) antes de validar unicidad.

## C7 — Sin validaciones en sucursales · **ERROR CONFIRMADO (menor)**
- **Evidencia**: `sucursales.routes.ts` sin `validate(schema)` ni `validateIdParam`.

## C8 — Código muerto y stubs · **RECOMENDACIÓN**
- `*.service.ts` (clientes/puestos/vehiculos) con funciones destructivas sin uso; `movimientos.controller` con create/update/delete no enrutados; `ForgotPassword.tsx` stub; `constants/vehiculo.ts` AKT `"akT"` inconsistente.

---

# D. REGLAS DE NEGOCIO SIN DEFINIR

| # | Situación | Pregunta | Recomendación del solicitante |
|---|---|---|---|
| D1 | Plan vence con vehículo dentro | ¿Mantener puesto ocupado hasta salida y cobrar excedente? | Mantener OCUPADO; cobrar excedente al salir |
| D2 | Renovación anticipada | ¿Sumar desde vencimiento anterior? | Sí, sin perder días |
| D3 | Cliente no renueva | ¿Cuándo liberar el puesto? | Conservar hasta fecha final, luego liberar |
| D4 | Plan sin puesto fijo | ¿Puesto libre compatible por estancia? | Sí, sin apropiarse de reservados |
| D5 | Cambio de tarifa | ¿Congelar al ingreso o usar la vigente al salir? | No modificar retroactivamente |
| D6 | Cambio de propietario | ¿Historial de propietarios? | Conservar historial |
| D7 | Vehículo con dos planes | ¿Impedir solapamiento? | Sí |
| D8 | Pago parcial | ¿Cómo se representa y aplica? | Conservar saldo y abonos |
| D9 | Cobro por ausencia con plan | ¿Cobra? | (definir) |
| D10 | Saldo del cliente | ¿Cuenta corriente? ¿Historial? | (definir) |
| D11 | IVA (`config.iva`) | ¿Aplica a facturas? | (definir; hoy no se calcula en `calculadorCobros`) |
| D12 | Unicidad de puesto por sucursal | ¿Cambiar a compuesta? | Sí |

---

# E. ESCENARIOS SIN COBERTURA DE PRUEBAS

**Mensualidades**: primera entrada, salida, reingreso mismo día, múltiples entradas/día, entrada un día y salida días después, plan sin puesto, plan con puesto, **vence dentro** (A1), **vence fuera**, vence en el instante de entrada/salida, renovar antes/después, pago parcial/completar, **renovar+pagar simultáneo** (A2), segunda mensualidad mismo período, cambio de plan, cancelar/desactivar, ausencia durante plan, congelar/extender/descontar (efecto real), ingreso mientras corre el scheduler.

**Puestos**: transición de cada estado; puesto fijo al salir/volver; flexible; dos vehículos al último libre; dos empleados mismo puesto; tipo incompatible (B1); mantenimiento de puesto ocupado; eliminar/desactivar ocupado; reserva+mensualidad; sin puestos libres; "libre" con vehículo dentro; RESERVADO+OCUPADO incorrecto.

**Clientes/Vehículos**: placa con espacios/guiones/mayúsculas (C6); vehículo de otro cliente (cubierto); ingreso cliente ≠ propietario; cambio de propietario (A4); eliminar con historial (cubierto parcial); modificar vehículo con ingreso activo; dos empleados creando el mismo vehículo; cambio de placa con mensualidad.

**Tarifas**: cambio en caliente (B2); cruzar medianoche; estancia mínima/exacta; redondeos; cada modalidad (cubierto unit); cortesía (cubierto); ticket perdido (cubierto); salida duplicada (cubierto); factura duplicada; pago parcial; saldo a favor/insuficiente; anulación; reintento tras error.

**Caja/Pagos**: pago duplicado; factura sin movimiento; movimiento sin factura; doble descuento de saldo; cerrar caja con operaciones en curso (parcial cubierto); modificar caja cerrada (cubierto); renovación con dos mensualidades (A2); pérdida de trazabilidad de abono.

**Reservas/Ausencias**: reserva vencida y llegada tardía; llegada temprana; dos reservas cruzadas (cubierto); cancelar con ingreso; mensualidad fija + ausencia; congelar y seguir considerando vigente; descontar y modificar vencimiento; extender y duplicar período; ausencia coincide con vencimiento; ausencia sin vehículo dentro.

**Sucursales/Permisos**: aislamiento por sede; consultas sin filtro; registros sin sucursal; usuario accede a otra sede; permisos UI vs API; endpoints sin auth; usuario desactivado con sesión (cubierto: `tokenVersion`).

**Concurrencia/Recuperación**: doble clic registrar ingreso (cubierto: locks); pérdida de conexión tras guardar; reintento HTTP; dos entradas mismo vehículo (cubierto); reinicio durante pago; scheduler vence mientras se registra entrada; tarea doble; restore con relaciones inconsistentes; operación con datos obsoletos (cubierto: `updatedAt`/`409`).

---

# F. MATRIZ DE ESCENARIOS (muestra)

| Escenario | Esperado | Actual (código) | Estado | Riesgo | Evidencia |
|---|---|---|---|---|---|
| Mensual sale y vuelve mismo día | Cubierto, cobro 0, recupera puesto | No cobra; recupera puesto del plan | ✔ OK | — | `registrarIngreso`/`salida-con-cobro` |
| Mensual sin puesto entra sin libres | Rechaza | `puestoEstaDisponibleParaAsignar` rechaza | ✔ OK | — | `ingresos.controller.ts:171` |
| Plan vence con vehículo dentro | Mantener puesto; cobrar solo excedente | **Libera puesto; cobra por tiempo** | ✖ ERROR | CRÍTICO | `scheduler.ts:91-100` + `salida:592` |
| Ausencia con plan vigente | Cobro 0 | **Cobra por tarifa** | ✖ ERROR | CRÍTICO | `ausencias.controller.ts:56-65` |
| Renovar + cobrar simultáneo | Un período activo | Locks distintos → posible doble período | ⚠ RIESGO | CRÍTICO | `mensualidades:558` vs `:214-215` |
| Carro a puesto de moto (API) | Rechaza | **Acepta** | ✖ ERROR | ALTO | `ingresos.controller.ts` (sin validar tipo) |
| Placa `ABC-123` vs `ABC 123` | Misma placa | Distintas | ✖ ERROR | MEDIO | `vehiculos.controller.ts:11` |
| Puesto P-01 en dos sedes | Permitido | **Prohibido** (`@unique` global) | ✖ ERROR | ALTO(multi-sede) | `schema.prisma:149` |
| Cambio total de cuenta (historial) | Trazable | Sin entidad propietarios | ⚠ RIESGO | MEDIO | `schema.prisma` |
| Factura anulada no cuenta | Fuera de totales | Por `anulado` (mov. caja) | ✔ OK | — | `caja.helpers.ts` |

---

# G. PROPUESTA DE SOLUCIÓN (sin implementar)

1. **Ocupación coherente ante vencimiento**: en `vencerMensualidades`, si hay `Ingreso` ACTIVO para el vehículo, **no** liberar el puesto; marcar la mensualidad VENCIDA pero conservar OCUPADO hasta la salida, y cobrar el excedente en la salida.
2. **Unificar renovación**: una sola vía (o mismo lock por vehículo) para `cobrarMensualidad` y `renovarMensualidad`, con verificación de solapamiento.
3. **Ausencia con plan**: consultar mensualidad vigente antes de facturar.
4. **Validar tipo de puesto** en `registrarIngreso`/`actualizarIngreso`.
5. **Validar tipo de puesto** y **normalizar placa** (espacios/guiones) en vehículos.
6. **Unicidad de puesto** `(sucursalId, codigo)`.
7. **Snapshot de tarifa/desglose** en ingreso/factura.
8. **Entidad de historial de propietarios** de vehículo.
9. **Endurecer** `crear-admin`, permisos UI, `formatearSistema`, validaciones de sucursales.
10. **Entidad `Pago`** opcional según D8.

---

# H. ORDEN RECOMENDADO DE CORRECCIÓN

1. **A1** (ocupación/vencimiento) — impacto físico y económico.
2. **A3** (ausencia con plan) — cobro indebido.
3. **A2** (renovación/pago) — duplicación de períodos.
4. **B1** (tipo de puesto) + **B2** (tarifa en caliente).
5. **B3** (unicidad por sucursal) + aislamiento multi-sede.
6. **A4/C1/C2** (trazabilidad: propietarios, snapshot, duplicación plan).
7. **B7/B8/C6/C7** (robustez, permisos, validaciones).
8. **Pruebas integrales** (sección E).

---

## Respuesta a la pregunta central

> "¿Con 200 vehículos, mensualidades, pagos diarios, reservas, empleados y varias sucursales, todos los procesos seguirán siendo coherentes?"

**Hoy: NO del todo.** El sistema es sólido en concurrencia de ingresos/caja y en integridad financiera básica, pero presenta **tres fallas críticas de coherencia** (A1, A2, A3) que pueden producir **doble ocupación, cobros indebidos o períodos duplicados** en operación real, y **brechas multi-sucursal** (B3) que impiden operar varias sedes con códigos de puesto propios. Con las correcciones priorizadas (sección H) y las decisiones de negocio (sección D), el sistema puede alcanzar ese nivel.

> Todos los hallazgos citan archivo y función. Los marcados **NO VERIFICADO** requerirían ejecución; ninguno se declaró como funcionando por existir solo validación de frontend.

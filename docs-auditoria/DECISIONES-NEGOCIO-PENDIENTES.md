# DECISIONES DE NEGOCIO PENDIENTES — Parqueadero

> Fase de **definición de reglas**. NO se modificó código, no se crearon migraciones, no se tocó la base de datos ni producción.
> Documento generado a partir de `AUDITORIA-INTEGRAL-FINAL.md`, `IMPLEMENTACION-hecho-vs-pedido.md`, las auditorías previas y **verificación directa del código actual**.
>
> **Diferencia importante** (según pediste):
> - **ERROR CONFIRMADO** = el código hace algo que contradice una regla correcta.
> - **FUNCIONALIDAD AUSENTE** = algo que no existe y hay que decidir si construir.
> - **DECISIÓN PENDIENTE** = el sistema funciona, pero necesita que tú definas la regla de negocio.

---

## Estado de las decisiones ya confirmadas

| ID | Tema | Decisión confirmada | Verificación en código |
|---|---|---|---|
| D2 | Cobro de plan vencido | Cobrar **solo el excedente** desde la fecha/hora de vencimiento | ✅ `ingresos.controller.ts`: detecta mensualidad que cubría la entrada y cobra desde `coberturaHasta`; `scheduler.ts` no libera puesto ocupado |
| D3 | Límite de sesión | Límite absoluto de **12 horas** | ✅ `usuarios.controller.ts:321`: `MAX_SESSION_MS = 12h` valida `iat` en `refreshToken` |

No se vuelven a preguntar salvo contradicción.

---

# DECISIONES PENDIENTES

---

## D1. Anulación de facturas · FUNCIONALIDAD AUSENTE (impacto contable ALTO)

- **Situación actual:** no existe forma de anular una factura. El módulo `facturas` es de solo lectura. El modelo `Factura` no tiene campo de anulación. Si un movimiento de caja tiene `facturaId`, `eliminarMovimientoCaja` **rechaza** anularlo (409) y remite a "su módulo de origen", que no ofrece anulación.
- **Ejemplo real:** el empleado cobra $50.000 a un cliente; se equivoca y era $5.000. Hoy **no hay forma de corregirlo**: la factura queda sumando en dashboard y reportes, el movimiento de caja no se puede tocar, y el saldo/ingreso ya quedó mal.
- **Problema:** un error de cobro es permanente; no se puede refacturar ni ajustar sin intervención directa en la base de datos.
- **Alternativa A — Anular (soft-delete con contrapartida):** marcar la factura `anulada=true` + motivo + usuario + fecha, revertir el movimiento de caja y, si corresponde, devolver saldo. La factura deja de contar en totales pero **permanece visible** para auditoría. *(La más recomendada para un parqueadero.)*
- **Alternativa B — Eliminar (hard-delete):** borrar la factura y su movimiento. **No recomendado**: destruye historial, rompe folios y auditoría.
- **Alternativa C — Nota de crédito:** emitir un documento nuevo negativo que compensa. Es lo que hace la contabilidad formal, pero agrega complejidad (nuevo tipo de documento, numeración, PDF).
- **Ventajas/desventajas:**
  - A: conserva historia, sencilla, reversible; requiere decidir si la anulación reabre caja cerrada (normalmente **no**).
  - B: simple pero peligrosa; pierde trazabilidad.
  - C: correcta contablemente; más trabajo y confusa para un parqueadero pequeño.
- **Módulos afectados:** facturas, caja, ingresos, mensualidades, dashboard, reportes.
- **Tablas afectadas:** `Factura` (nuevos campos `anulada`, `anuladaEn`, `anuladoPor`, `motivoAnulacion`); efectos en `CajaMovimiento` (anular el movimiento ligado), `Cliente.saldo` (si se usó saldo).
- **Consecuencias:** reports/dashboard deben excluir facturas anuladas; la caja debe reflejar el reverso; el histórico se conserva.
- **Recomendación técnica:** Alternativa A. Añadir campos de anulación a `Factura`, un endpoint `POST /facturas/:id/anular` (admin), que anule el `CajaMovimiento` ligado con `anulado=true` y motive el ledger. Restringir a admin.
- **Qué necesito decidir:** ¿implementamos anulación (A)? ¿Solo admin? ¿Se permite anular una factura cuya caja ya está cerrada (genera ajuste del día actual) o se bloquea?

**Nota técnica:** la anulación NO debe borrar; debe marcar y compensar. Y debe decidirse si la anulación revierte el consumo de saldo del cliente.

---

## D4. Puestos masivos multi-sucursal · ERROR CONFIRMADO (ALTO para multi-sede)

- **Situación actual:** `crearPuestosMasivosSchema` **no declara `sucursalId`**, así que Zod lo descarta; además la numeración se calcula sobre **todos** los puestos sin filtrar por sucursal. La unicidad `@@unique([sucursalId, codigo])` no detecta duplicados cuando `sucursalId` es `NULL` (PostgreSQL trata cada NULL como distinto).
- **Ejemplo real:** quieres crear 20 puestos "A1..A20" en la sede Montería, pero ya existen "A1..A20" en Sahagún; el sistema no deja fijar la sede y puede generar códigos duplicados globales.
- **Alternativa A — Fijar `sucursalId` explícito:** el schema acepta `sucursalId`; la numeración filtra por esa sede; el índice compuesto evita duplicados dentro de la sede; se permite el mismo código en sedes distintas.
- **Alternativa B — Sucursal obligatoria:** exigir `sucursalId` siempre (no permitir puestos "globales").
- **Alternativa C — Dejar como está:** no recomendado (rompe multi-sede).
- **Ventajas/desventajas:** A resuelve el problema y mantiene compatibilidad; B es más estricta pero rompe instalaciones de una sola sede que hoy usan `null`.
- **Módulos afectados:** puestos, reservas, mensualidades, ingresos (asignación de puestos), fichas de sucursal.
- **Tablas afectadas:** `Puesto` (solo índice/uso, no estructura nueva). Posible cambio de índice.
- **Recomendación técnica:** Alternativa A. Añadir `sucursalId` al schema, filtrar numeración por sucursal, y tratar el índice para evitar colisiones con NULL (usar 0/`sucursal` por defecto o validación explícita).
- **Qué necesito decidir:** ¿la sede es obligatoria al crear puestos, o permitimos puestos sin sede (instalación de una sola sede)?

---

## D5. Intentos de inicio de sesión · ERROR CONFIRMADO (MEDIO)

- **Situación actual:** el login bloquea tras **5 intentos fallidos** durante 15 minutos, con valores **fijos en el código**. El `intentosMaximos` de Configuración solo afecta al *rate limiter* (por minuto), NO al bloqueo real.
- **Ejemplo real:** el admin configura "3 intentos" pero el sistema sigue bloqueando a los 5; o configura "20" y sigue bloqueando a los 5.
- **Problema:** la configuración de seguridad no hace lo que dice.
- **Alternativa A — Conectar `intentosMaximos` al bloqueo real** (el valor fijo pasa a leerse de configuración).
- **Alternativa B — Dejar fijo** y quitar la promesa del panel (no recomendado).
- **Alternativa C — Configurable con tope** (p. ej. permitir entre 3 y 10, duración de bloqueo configurable).
- **Ventajas/desventajas:** A da control al dueño; C evita dejar el sistema inseguro con "1 intento".
- **Módulos afectados:** usuarios, configuración.
- **Tablas afectadas:** ninguna nueva (`Configuracion.intentosMaximos` ya existe); se usaría también `Usuario.intentosFallidos`/`bloqueadoHasta` (ya existen).
- **Recomendación técnica:** Alternativa C (configurable con rango y duración), y documentar el comportamiento.
- **Qué necesito decidir:** ¿cuántos intentos y cuánto dura el bloqueo? ¿Configurable o fijo?

---

## D6. Saldo del cliente · DECISIÓN PENDIENTE (MEDIO)

- **Situación actual:** `Cliente.saldo` es un único número **por cliente** (no por vehículo ni por sede). Se recarga (manual) y se consume al pagar salidas/suscripciones. No hay libro de movimientos de saldo.
- **Ejemplos:**
  - Cliente con 2 vehículos: recarga $100.000; hoy ese saldo lo pueden gastar **cualquiera de sus dos vehículos** (billetera compartida).
  - Cliente en 2 sedes: el saldo es único; una recarga en Sahagún es consumible en Montería.
- **Alternativa A — Saldo global del cliente** (lo actual). Simple; sirve si el cliente es una cuenta corriente única.
- **Alternativa B — Saldo por vehículo.** Cada vehículo tiene su billetera; más control, pero más operativo (¿a quién pertenece el saldo si cambia el vehículo?).
- **Alternativa C — Saldo por sucursal.** Evita mezclar sedes; útil si cada sede maneja su propia caja.
- **Ventajas/desventajas:** A simple y ya está; B/C más correctas para ciertos negocios pero requieren cambiar modelo, cajas, facturas y reportes.
- **Módulos afectados:** clientes, salidas, mensualidades, caja, reportes.
- **Tablas afectadas:** `Cliente.saldo` (existente); B implicaría nueva tabla/campo por vehículo; C requeriría `sucursalId` en saldo.
- **Recomendación técnica:** si el negocio entiende el saldo como "cuenta corriente del cliente", **A** es suficiente; si cada sede factura por separado, **C**. Recomiendo también añadir un **historial de movimientos de saldo** (libro) en cualquier caso.
- **Qué necesito decidir:** ¿el saldo es del cliente, del vehículo o de la sede? ¿Agregamos historial de movimientos de saldo?

---

## D7. Clientes globales o por sucursal · DECISIÓN PENDIENTE (MEDIO / privacidad)

- **Situación actual:** `Cliente` **no tiene `sucursalId`**. Cualquier usuario autenticado ve el nombre, documento, teléfono y saldo de **todos** los clientes, sin importar la sede.
- **Ejemplo real:** el empleado de la sede Montería puede ver los datos personales y el saldo de todos los clientes de Sahagún.
- **Alternativa A — Clientes globales** (lo actual): un cliente puede operar en cualquier sede. Riesgo de privacidad (todos ven a todos) y confusión si dos sedes registran al mismo cliente (duplicados).
- **Alternativa B — Clientes por sucursal:** cada sede maneja sus clientes; privacidad y aislamiento, pero un cliente que va a otra sede se registra de nuevo; los vehículos/planes no se comparten.
- **Alternativa C — Cliente global + visibilidad por sucursal:** el cliente existe una vez, pero solo lo ven las sedes donde tiene actividad. Más complejo.
- **Ventajas/desventajas:** A simple pero sin privacidad; B aislado pero duplica; C correcto pero requiere lógica de "sedes asociadas".
- **Módulos afectados:** clientes, vehículos, mensualidades, reservas, ingresos, reportes, dashboard, permisos.
- **Tablas afectadas:** A ninguna; B añadir `sucursalId` a `Cliente`; C añadir relación cliente↔sucursal.
- **Recomendación técnica:** si priorizas simplicidad y hay 1 sede efectiva → A (y documentar que todos ven los clientes). Si vas multi-sede real y con datos sensibles → C.
- **Qué necesito decidir:** ¿el cliente pertenece a la sede, es global, o global con visibilidad restringida?

---

## D8. IVA · DECISIÓN PENDIENTE (fiscal)

- **Situación actual:** existe `Configuracion.iva` (porcentaje) pero el **calculador de cobros no lo aplica**; las facturas no guardan IVA.
- **Ejemplo real:** tarifa $5.000/hora. ¿Es $5.000 + IVA (si aplica) o $5.000 con IVA incluido? Hoy el sistema cobra $5.000 sin distinguir.
- **Alternativa A — Sin IVA** (actual): el precio es el total. Correcto para servicios exentos o si los precios ya son finales.
- **Alternativa B — IVA aplicado por encima:** el precio base + IVA; la factura muestra subtotal, IVA y total.
- **Alternativa C — IVA incluido en el precio:** el precio ya lo contiene; la factura desglosa.
- **Ventajas/desventajas:** A simple; B/C correctas si estás obligado a facturar con IVA; requieren guardar el % histórico por factura.
- **Módulos afectados:** tarifas, planes, salidas, mensualidades, recargas, facturas, reportes, caja.
- **Tablas afectadas:** `Configuracion.iva` (existe); `Factura` necesitaría `subtotal`, `iva`, `total` (o `ivaPorcentaje`).
- **Recomendación técnica:** si estás obligado a facturar con IVA → B y guardar el % en cada factura (para que el histórico no cambie si mañana lo modificas). Si no → A y ocultar el campo.
- **Qué necesito decidir:** ¿cobras IVA? ¿Incluido o añadido? ¿Qué porcentaje?

---

## D9. Aforo global · DECISIÓN PENDIENTE (capacidad)

- **Situación actual:** no hay "capacidad máxima"; la disponibilidad es simplemente la cantidad de `Puesto` LIBRE. No se limita por tipo de vehículo ni por parqueadero.
- **Ejemplo real:** un parqueadero con 50 puestos de carro: no hay control de "no admitir más de 50 carros" más allá de que no haya puesto libre. Y no hay límite de aforo total si hubiera puestos sin asignar.
- **Alternativa A — Solo por puestos** (actual): la capacidad es la cantidad de puestos.
- **Alternativa B — Aforo configurable por sucursal/tipo:** el admin fija un máximo y el sistema bloquea ingresos al alcanzarlo.
- **Alternativa C — Mixto:** puestos + aforo máximo.
- **Ventajas/desventajas:** A simple y suficiente si los puestos son la verdad; B útil si hay "overbooking" permitido o zonas sin puesto.
- **Módulos afectados:** dashboard, puestos, ingresos, reportes.
- **Tablas afectadas:** B añadiría `Configuracion.aforoMaximo` o tabla por sucursal.
- **Recomendación técnica:** A es suficiente para la mayoría; solo B si necesitas límite independiente de puestos.
- **Qué necesito decidir:** ¿necesitas aforo máximo separado de los puestos?

---

## D10. Reservas y estado RESERVADO · DECISIÓN PENDIENTE (operación)

- **Situación actual:** al **crear** una reserva con puesto, el puesto queda **RESERVADO de inmediato**, aunque la reserva sea para dentro de 3 meses. No se distingue una reserva futura de una vigente para el estado físico del puesto.
- **Ejemplo real:** Juan reserva el puesto A1 para diciembre. Hoy (agosto) el puesto A1 ya figura RESERVADO y nadie más lo puede usar hasta diciembre. Dos clientes que quieren el mismo puesto en fechas distintas: el segundo no puede (aunque no se solapen).
- **Alternativa A — Reservar inmediatamente** (actual): simple pero bloquea puestos mucho antes.
- **Alternativa B — Reservar al acercarse la fecha:** el puesto se marca RESERVADO solo en la ventana de la reserva; antes queda LIBRE.
- **Alternativa C — Dispinibilidad por fechas (entidad independiente):** la reserva no "ocupa" el puesto; la disponibilidad se calcula por rango de fechas. Es lo correcto para permitir varias reservas no solapadas.
- **Ventajas/desventajas:** A simple y sobre-bloquea; B mejora pero parcial; C correcta, más compleja (cambio de lógica y de cálculo de disponibilidad).
- **Módulos afectados:** reservas, puestos, ingresos, mensualidades, dashboard.
- **Tablas afectadas:** C no cambia estructura necesariamente, pero cambia toda la lógica de disponibilidad (hoy el estado del puesto es un campo).
- **Recomendación técnica:** C es lo correcto si manejas reservas con fechas; B es un intermedio. A solo si las reservas son siempre inmediatas.
- **Qué necesito decidir:** ¿las reservas pueden ser a futuro lejano sin bloquear el puesto? ¿Cómo tratamos retrasos y no-show?

---

## D11. Estado manual de los puestos · RIESGO (consistencia)

- **Situación actual:** `PUT /puestos/:id` (admin/supervisor) permite poner `estado` a OCUPADO, RESERVADO, AUSENCIA **a mano**, sin ingreso ni reserva. Esto rompe el invariante "OCUPADO ⇔ hay vehículo dentro".
- **Ejemplo real:** un admin marca un puesto OCUPADO por error y el sistema cree que hay un vehículo que no existe; o marca LIBRE un puesto que tiene un auto.
- **Alternativa A — Estado siempre calculado:** el estado se deriva de ingresos/reservas/mensualidades/ausencias; el admin solo puede LIBRE↔MANTENIMIENTO.
- **Alternativa B — Manual permitido:** como hoy (riesgoso).
- **Alternativa C — Manual con auditoría:** permitir override pero solo por admin, con registro de auditoría y advertencia.
- **Ventajas/desventajas:** A consistente; C flexible pero puede generar inconsistencias; B peligrosa.
- **Módulos afectados:** puestos, ingresos, reservas, ausencias, dashboard.
- **Tablas afectadas:** ninguna nueva (posiblemente auditoría en `Movimiento`).
- **Recomendación técnica:** A (derivar el estado), permitiendo solo MANTENIMIENTO/LIBRE manual y, si se necesita "bloquear" un puesto, marcarlo MANTENIMIENTO.
- **Qué necesito decidir:** ¿el estado debe ser siempre automático, o permitimos override manual auditado?

---

# OTROS HALLAZGOS QUE NECESITAN DECISIÓN

## O7. Tarifas activas duplicadas · RIESGO
- **Actual:** si hay 2+ tarifas activas para el mismo tipo+modalidad, el calculador toma **la más barata en silencio**.
- **Ejemplo:** dos tarifas "carro/hora" activas ($5.000 y $4.000) → cobra $4.000 sin avisar.
- **Opciones:** (A) impedir duplicados al crear; (B) permitir con prioridad explícita; (C) exigir configuración única por tipo+modalidad+sede.
- **Recomendación:** (A) validar que no existan dos activas iguales para el mismo alcance; si existen, **error** en vez de elegir. Decisión: ¿impedimos o priorizamos?

## Entidad `Pago` · FUNCIONALIDAD AUSENTE
- **Actual:** los abonos son `Factura` con `metodoPago`. No se distingue "factura" de "pago/abono".
- **Ejemplo:** cliente paga $30.000 a cuenta de $100.000 → una factura por $30.000. Si paga en efectivo y tarjeta, son dos facturas.
- **Opciones:** (A) mantener `Factura` con `metodoPago` (actual); (B) crear entidad `Pago` (`facturaId`, `monto`, `metodoPago`, `fecha`) y tratar la factura como documento.
- **Recomendación:** (B) si facturas con IVA o necesitas conciliar métodos de pago por separado; (A) es suficiente para un parqueadero simple. Decisión: ¿creamos `Pago`?

## Historial de propietarios · FUNCIONALIDAD AUSENTE
- **Actual:** `Vehiculo.clienteId` se sobrescribe al cambiar de dueño; se pierde el dueño anterior.
- **Ejemplo:** Juan vende a Pedro; los ingresos viejos dicen "Juan" pero no hay registro formal del cambio.
- **Opción:** tabla `VehiculoPropietario` (`vehiculoId`, `clienteId`, `desde`, `hasta`). Decisión: ¿lo necesitas?

## Renovaciones de mensualidades · RIESGO
- **Actual:** `cobrarMensualidad` al saldar **reescribe el mismo registro** (`fechaInicio` nueva); `renovarMensualidad` sí crea uno nuevo. Dos comportamientos distintos.
- **Ejemplo:** tras pagar, el registro viejo "desaparece" del período; sólo queda la factura.
- **Recomendación:** unificar a **crear un nuevo período** (conserva historial). Decisión: ¿unificamos?

## Gastos recurrentes · RIESGO
- **Actual:** el scheduler **no** ejecuta `generarRecurrentes`; hay que pulsar un botón.
- **Recomendación:** que el scheduler (o un cron diario) genere los recurrentes respetando sucursal, sin duplicar. Decisión: ¿automatizamos?

## Cierre de caja · DECISIÓN
- **Actual:** `Caja.cierre` guarda el **esperado**; el conteo real y la diferencia quedan como texto en `observacion`.
- **Recomendación:** guardar en columnas `conteoEfectivo`, `esperadoEfectivo`, `diferencia` para reportes. Decisión: ¿agregamos columnas?

## Backup y restauración · PRUEBAS
- **Falta:** pruebas de backup/restore aisladas (base de prueba), sin tocar producción. Decisión: ¿incluimos en las pruebas de regresión?

---

# COHERENCIA ENTRE MÓDULOS (verificación de contradicciones)

Revisé que las decisiones no choquen entre sí:
- **Anulación de factura ↔ caja/reportes:** debe excluir la factura de totales y revertir el movimiento → coherente con D1 (Alternativa A).
- **Renovación ↔ períodos/facturas:** unificar a "nuevo período" (ver arriba) evita el conflicto con el cobro.
- **Reserva ↔ disponibilidad ↔ puesto:** si se adopta D10-C, el estado del puesto deja de ser "fuente de verdad" para reservas; hay que ajustar D11 en consecuencia (estado derivado).
- **Saldo (D6) ↔ caja/facturas:** si el saldo es por sede (C), las facturas y cajas deben llevar la misma sede.
- **Clientes por sucursal (D7) ↔ reservas/mensualidades:** si el cliente es por sede, la reserva y la mensualidad heredan la sede.
- **Puestos multi-sede (D4) ↔ D10/D11:** la disponibilidad por fechas debe filtrar por sede.

**Conclusión de coherencia:** las decisiones **no son independientes**. Las de mayor arrastre son **D7 (clientes/sucursal)**, **D10 (reservas/disponibilidad)** y **D1 (anulación de factura)**. Conviene decidirlas antes de tocar código.

---

# RESUMEN: qué necesito que decidas

## Decisiones confirmadas (no requieren acción)
- D2 — Cobro solo del excedente (implementado).
- D3 — Sesión máxima 12 h (implementado).

## Decisiones pendientes (necesito tu respuesta)
| # | Tema | Pregunta clave |
|---|---|---|
| D1 | Anulación de facturas | ¿Implementamos anulación soft con contrapartida? ¿Solo admin? ¿Reabre caja cerrada? |
| D4 | Puestos masivos | ¿Sede obligatoria o permitir sin sede? |
| D5 | Intentos de login | ¿Configurable? ¿Cuántos y cuánto dura el bloqueo? |
| D6 | Saldo del cliente | ¿Global, por vehículo o por sede? ¿Historial de movimientos? |
| D7 | Clientes y sucursal | ¿Global, por sede, o global con visibilidad restringida? |
| D8 | IVA | ¿Cobras IVA? ¿Incluido o añadido? ¿%? |
| D9 | Aforo global | ¿Límite independiente de puestos? |
| D10 | Reservas/disponibilidad | ¿Reserva inmediata, al acercarse, o por fechas? |
| D11 | Estado manual de puestos | ¿Automático, o override manual auditado? |
| O7 | Tarifas duplicadas | ¿Impedir o priorizar? |
| Pago | Entidad `Pago` | ¿La creamos? |
| Propietarios | Historial | ¿Lo necesitas? |
| Renovaciones | Unificar | ¿Crear nuevo período siempre? |
| Recurrentes | Automatizar | ¿Scheduler los genera? |
| Cierre de caja | Columnas | ¿Guardamos conteo/diferencia en columnas? |

---

# ORDEN RECOMENDADO PARA DECIDIR

Si quieres priorizar por impacto en el funcionamiento y la contabilidad:
1. **D1 — Anulación de facturas** (no poder corregir un cobro es el mayor riesgo contable).
2. **D7 — Clientes y sucursal** (define privacidad y todo el modelo multi-sede).
3. **D10 — Reservas/disponibilidad** (define la operación de reservas y el estado de puestos).
4. **D6 — Saldo del cliente** (afecta cobros y caja).
5. **D11 — Estado de puestos** (consistencia diaria).
6. **D8 — IVA** (fiscal).
7. **D4, D5, D9, O7, Pago, Propietarios, Renovaciones, Recurrentes, Cierre, Backup.**

> Cuando me apruebes cada decisión, podré (en una fase posterior y con tu autorización) implementar los cambios, actualizar migraciones y crear las pruebas de regresión correspondientes.

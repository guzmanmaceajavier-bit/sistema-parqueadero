# Mapa Funcional del Parqueadero — Comportamiento Real por Menú

Generado a partir de la simulación end-to-end (`backend/prisma/seed/simular-flujos.mjs`)
ejecutada contra PostgreSQL real. Los códigos HTTP y mensajes son **resultados reales**.

---

## 0. Autenticación (común a todos los menús)

| Acción | Resultado real |
|---|---|
| `POST /api/usuarios/login` con admin/clave correcta | `200` → `{ ok:true, usuario:{ rol:"admin" } }`, devuelve cookie de sesión |
| Login con clave incorrecta | `401` → `"Credenciales incorrectas"` |

La cookie se envía en cada petición. Las rutas de **Auditoría** y **Configuración**
exigen rol `admin` o `supervisor`; **Usuarios, Sucursales y Backup** solo `admin`.

---

## 1. Clientes — `Clientes → Registro`

**Qué hace:** alta, edición, bloqueo y saldo de clientes. Un cliente puede tener
múltiples vehículos. Campos: nombres, apellidos, documento (único), teléfono,
email, dirección, saldo, bloqueado.

**Ejemplo real:**
```
POST /api/clientes { nombres:"Ana", apellidos:"Simulación", documento:"SIM9681", telefono:"3001112222" }
→ 201 { cliente:{ id:84, estado:"ACTIVO" } }
POST /api/clientes (documento repetido)
→ 400 "El documento ya está registrado"
```

**Reglas observadas:**
- Documento duplicado se rechaza (400).
- Cliente bloqueado no puede ingresar al parqueadero.
- El saldo se usa en salidas: se descuenta automáticamente del cobro.

---

## 2. Vehículos — `Clientes → Vehículos`

**Qué hace:** registrar vehículos por cliente. Normaliza placa a mayúsculas,
controla tipo (carro/moto/bicicleta), clase, marca, modelo, color, tarifa y
estado. Un vehículo pertenece a un cliente y a una sucursal.

**Ejemplo real:**
```
POST /api/vehiculos { placa:"sim9681a", tipo:"carro", marca:"Toyota", clienteId:84 }
→ 201 { vehiculo:{ placa:"SIM9681A" } }         (placa normalizada)
POST /api/vehiculos (misma placa otra vez)
→ 400 "La placa SIM9681A ya pertenece a Ana Simulación"
```

**Reglas observadas:**
- Placa única en todo el sistema.
- Al dar de alta con plan vigente, el vehículo queda ligado a ese plan.
- `tarifaId` define el cobro por tiempo cuando no hay plan.

---

## 3. Puestos — `Parqueadero → Puestos`

**Qué hace:** inventario de celdas. Cada puesto tiene código, zona, tipo
(carro/moto/o ambos), estado derivado y sucursal.

**Estados del puesto (derivados, no se editan a mano):**
| Estado | Significado |
|---|---|
| `LIBRE` | Sin ingreso, sin plan vigente, sin reserva activa |
| `RESERVADO` | Tiene plan vigente o reserva, pero ningún vehículo físicamente dentro |
| `OCUPADO` | Hay un ingreso ACTIVO (vehículo dentro) |
| `MANTENIMIENTO` | Fuera de servicio |

**Ejemplo real:**
```
POST /api/puestos { codigo:"SIM-A", tipoPuesto:"carro", zona:"Sim" }
→ 201 { puesto:{ id:103, estado:"LIBRE" } }
```

**Regla importante:** el estado se **recalcula** al entrar, salir, crear/cancelar
plan, crear/cancelar reserva y eliminar registros. Nunca queda "colgado".

---

## 4. Planes y Suscripciones — `Configuración → Planes` y `Suscripciones → Suscripciones`

**Qué hace:** un **plan** es la promesa comercial (30 días, $200.000, tipo carro).
Una **suscripción/mensualidad** es esa promesa aplicada a un vehículo, con fechas
y puesto fijo opcional.

**Ejemplo real (flujo completo verificado):**
```
POST /api/planes { nombre:"Plan Mensual", duracionDias:30, valor:200000, tipoVehiculo:"carro" }
→ 201 { plan:{ id:2 } }

POST /api/mensualidades { clienteId, vehiculoId, puestoId:103, planId:2, fechaInicio, fechaFin }
→ 201 { mensualidad:{ id:27, puestoId:103 } }
   → el puesto 103 pasa a RESERVADO
```

**BUG CORREGIDO:** antes, este último paso daba `400 "valor: Expected number,
received nan"` porque el esquema exigía `valor` aunque viniera de `planId`.
Ahora `valor` es opcional y se deriva del plan.

**Reglas observadas:**
- No se pueden crear dos suscripciones que se crucen en el tiempo para el mismo vehículo.
- No se puede asignar un puesto ocupado o con otra reserva en ese periodo.
- El tipo de vehículo debe ser compatible con el puesto.
- **Renovar** ya no es un botón directo: solo se renueva al **registrar el pago**
  (`Cobrar mensualidad`). Así nunca hay cobertura sin factura.
- Pago parcial = abono (deja saldo). Pago total = renueva por la duración del plan,
  empezando al día siguiente del fin del periodo anterior (no pierde días pagados).

---

## 5. Entradas y Salidas — `Mov. Entrada → Entradas/Salidas`

**Es el corazón del parqueadero.** Flujo real verificado:

**5a. Registrar entrada con plan:**
```
POST /api/ingresos { clienteId, vehiculoId }
→ 201 { ingreso:{ puestoId:103 }, tipoIngreso:"plan_mensual" }
```
El sistema **detecta el plan vigente y autoasigna su puesto** (no hay que elegirlo).
El puesto pasa a `OCUPADO`.

**5b. Rechazos correctos:**
```
Entrada duplicada → 400 "El vehículo ... ya se encuentra dentro del parqueadero"
Carro en puesto de moto → 400 "El puesto ... no admite vehículos de tipo carro"
Sin puesto y sin plan/reserva → 400 "Debes seleccionar un puesto o tener reserva activa o plan vigente"
```

**5c. Simular cobro (antes de registrar salida):**
```
POST /api/ingresos/simular-cobro { ingresoId }
→ 200 { cobro:{ total:0, plan:"Plan Mensual" } }     (con plan vigente)
→ 200 { cobro:{ total:45000, minutos:180, ... } }    (sin plan, tarifa por tiempo)
```

**5d. Registrar salida con plan (no cobra):**
```
POST /api/ingresos/salida-con-cobro/103 { metodoPago:"efectivo" }
→ 200 "Salida cubierta por el plan, sin cobro diario adicional..."
   → NO genera factura
   → el puesto vuelve a RESERVADO (lo conserva el plan)
```

**5e. Registrar salida de cliente ocasional (sí cobra):**
```
POST /api/ingresos/salida-con-cobro/104 { metodoPago:"efectivo" }
→ 200 { factura:{ numero:"FACT-000002" }, cobro:{ total:150000 }, salida }
   → crea factura + movimiento de caja INGRESO
   → descuenta saldo del cliente si tiene
   → el puesto pasa a LIBRE
```

**5f. Reingreso del vehículo con plan:**
```
POST /api/ingresos { clienteId, vehiculoId }
→ 201 { puestoId:103, tipoIngreso:"plan_mensual" }   (recupera el MISMO puesto)
```

**Reglas de negocio implementadas:**
- **Excedente por vencimiento:** si el plan venció mientras el vehículo estaba
  dentro, se cobra **solo el tiempo posterior** al vencimiento, no toda la estancia.
- **Saldo del cliente:** se aplica automáticamente y se descuenta con auditoría.
- **Ticket extraviado:** se marca y se refleja en la factura.
- **Bloqueos transaccionales** (advisory locks) evitan doble entrada, doble salida
  y carreras entre salidas, anulaciones y pagos.

**BUG CORREGIDO:** la comparación de fechas en las consultas raw usaba la zona
horaria local contra columnas `timestamp without time zone`, dando un falso
`"La vigencia del plan cambió durante la operación" (409)`. Se corrigió con
`AT TIME ZONE 'UTC'` en 6 consultas.

---

## 6. Reservas — `Mov. Entrada → Reservas`

**Qué hace:** apartar un puesto para fechas futuras. Estados: PENDIENTE →
CONFIRMADA → ACTIVA (al entrar el vehículo) → FINALIZADA (al salir).

**Ejemplo real:**
```
POST /api/reservas { clienteId, vehiculoId, puestoId, fechaInicio:+5d, fechaFin:+6d }
→ 201 { reserva:{ id:12, estado:"PENDIENTE", puestoId:131 } }
```

**Reglas observadas:**
- No se puede reservar un puesto ya ocupado o con otra reserva en ese rango.
- Al registrar la entrada, la reserva se vincula al ingreso y pasa a ACTIVA.
- Al salir, pasa a FINALIZADA.
- Si hay reserva y plan con puestos distintos, se rechaza la entrada (409).

---

## 7. Ausencias — `Suscripciones → Ausencias`

**Qué hace:** registrar que un vehículo con plan sale temporalmente. Puede
compensar días (`diasCompensados`, `valorCompensado`) y recuerda el puesto
original para que el vehículo lo recupere al regresar.

**Ejemplo real:** un cliente de plan reporta ausencia el lunes, regresa el
miércoles → se crea ausencia FINALIZADA con `puestoId` y `fechaRegreso`; al
volver a entrar, el sistema usa ese puesto guardado.

---

## 8. Caja — `Caja → Estado`

**Qué hace:** apertura, arqueo y cierre. Una sola caja ABIERTA por sucursal.
Todos los movimientos (ingresos por factura, egresos por gasto) se ligan a la caja.

**Ejemplo real:**
```
POST /api/caja/abrir { apertura:50000 } → 201 { caja:{ id:15, apertura:50000 } }
POST /api/caja/abrir (otra vez) → 400 "Ya hay una caja abierta"
GET  /api/caja/actual → { ingresos, egresos, saldo }
PUT  /api/caja/cerrar/15 { conteo, observacion } → { esperado, totalConteo, diferencia }
```

**Regla:** todo pago (mensualidad o salida) exige caja abierta; si está cerrada,
se rechaza con `"Caja cerrada"` para no perder el registro financiero.
El arqueo calcula la diferencia entre lo esperado y lo contado.

---

## 9. Facturas — `Caja → Facturas`

**Qué hace:** documentos de cobro. Origen `INGRESO` (salida), `MENSUALIDAD` o
`MENSUALIDAD_AUTO` (deuda pendiente). Guarda snapshot de tarifa, modalidad,
tiempo y desglose para auditoría.

**Ejemplo real:**
```
Salida ocasional → FACT-000002 por $150.000
POST /api/facturas/2/anular { motivo:"" }
→ 400 "Debes indicar un motivo de anulación (mínimo 3 caracteres)"
POST /api/facturas/2/anular { motivo:"Error de prueba: cobro duplicado" }
→ 200 "Factura anulada con contrapartida y auditoría"
   → factura.anulada=true, anuladoPor, motivoAnulacion
   → su movimiento de caja queda anulado (fuera de los totales)
   → se crea movimiento de saldo CONTRAPARTIDA al cliente
```

**Regla de oro:** una factura **nunca se borra**; se anula con contrapartida para
preservar el historial financiero.

---

## 10. Gastos — `Caja → Gastos`

**Qué hace:** egresos de caja. Cada gasto genera un movimiento `EGRESO`.

**Ejemplo real:**
```
POST /api/gastos { concepto:"Papelería", categoria:"otros", valor:15000 }
→ 201 { gasto:{ id:16 } }
   → movimiento de caja EGRESO ligado al gasto
```

---

## 11. Movimientos y Reportes — `Auditoría` (admin/supervisor)

**Movimientos:** bitácora de todas las acciones (quién, qué módulo, cuándo, sede).
Ejemplo: `"Vehículo SIM9681A ingresó al puesto A — plan Plan Mensual"`.

**Reportes:** agregados de ingresos, ocupación, facturación por periodo y sede.
Respeta la visibilidad por sucursal del rol.

---

## 12. Configuración — `Configuración` (admin/supervisor)

| Submenú | Función |
|---|---|
| **Precios por Tiempo** | Tarifas por hora/día/semana/mes y tipo de vehículo. Sin duplicados (mismo tipo+modalidad). |
| **Planes** | Planes comerciales (duración, valor, tipo de vehículo). |
| **Usuarios** (admin) | Altas, roles (admin/supervisor/empleado) y sede. |
| **Sucursales** (admin) | Sedes; cada recurso pertenece a una. |
| **Backup** (admin) | Exportar/importar datos **sin contraseñas hasheadas** (seguridad). |
| **General** | Nombre, dirección, teléfono, correo, modo oscuro, parámetros de negocio. |

---

## 13. Dashboard — pantalla de inicio

Indicadores en vivo: vehículos dentro, puestos libres/ocupados/reservados,
ingresos del día, caja actual, alertas. Se actualiza por WebSocket al entrar/salir
vehículos.

---

## Resumen de reglas de integridad verificadas

1. Un vehículo **no puede estar dos veces** dentro.
2. El puesto del plan se **respeta** en entrada, salida y reingreso.
3. Salida con plan **no factura**; salida sin plan **sí factura y mueve caja**.
4. Anular factura **revierte** caja y saldo, sin borrar historial.
5. Fechas se comparan en **UTC** para evitar falsos conflictos por zona horaria.
6. Todo cambio de estado de puesto se **recalcula** desde ingreso/plan/reserva reales.

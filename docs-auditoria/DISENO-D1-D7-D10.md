# DISEÑO FUNCIONAL — D1, D7, D10

> Propuesta de diseño (SIN implementar). Cada decisión incluye comportamiento para propietario, empleado y cliente, flujo, tablas/relaciones, permisos, efectos en caja/facturas/reportes, errores/casos especiales y pruebas propuestas.
> Requiere aprobación antes de implementar.

---

# PARTE 1 — D1 · ANULACIÓN DE FACTURAS

## Recomendación aprobada
Anulación **con contrapartida y auditoría** (soft-delete): no se elimina; se marca anulada, se registra motivo/usuario/fecha y se genera el movimiento de caja contrario.

## 1. Cómo funciona para el propietario
- Ve en Facturas un estado por documento: **VIGENTE / ANULADA**.
- Puede anular un cobro erróneo indicando motivo; el reporte y el dashboard dejan de contar esa factura.
- Puede ver **quién** anuló, **cuándo** y **por qué** (auditoría).
- La caja del turno refleja el reverso; si la caja ya estaba cerrada, la anulación afecta a la caja abierta actual como "nota de ajuste" (ver casos especiales).

## 2. Cómo funciona para el empleado
- El empleado **no** puede anular (por defecto). Solo el admin (y opcionalmente supervisor, a decidir).
- El empleado sí ve que una factura está anulada y el motivo.

## 3. Cómo afecta al cliente
- Si pagó de más y se anula, el sistema debe decidir si se le **devuelve en efectivo** (movimiento EGRESO) o se le **acredita saldo** (D6). Esto depende de D6 (aún pendiente) → se deja como subdecisión D1-b.
- Su estado de cuenta mostrará la factura anulada y, si aplica, el reembolso.

## 4. Flujo completo
1. Admin abre la factura → botón **Anular**.
2. Escribe **motivo obligatorio** (mínimo N caracteres).
3. Sistema valida: factura existe, no está ya anulada, pertenece a su sucursal.
4. Según la factura:
   - Si tiene `CajaMovimiento` **en caja abierta**: se anula el movimiento (`anulado=true`, motivo "Anulado por factura X") y se crea el movimiento contrario (o se marca el existente). Recomendado: **anular el movimiento original** y dejar la factura marcada; los totales excluyen ambos.
   - Si tiene `CajaMovimiento` **en caja cerrada**: NO se toca el histórico; se crea un **movimiento de ajuste (EGRESO/INGRESO) en la caja abierta actual** con concepto "Ajuste por anulación factura X (caja #Y cerrada)".
   - Si es factura de **mensualidad**: revertir el efecto sobre el saldo pendiente del período (recalcular) y, si el pago completo había renovado, decidir si se revierte la renovación (subdecisión D1-c).
   - Si es factura de **ingreso con saldo de cliente usado**: devolver el `saldoUsado` al cliente (o no, a decidir).
5. Se registra `Movimiento` (auditoría) y se emite evento socket.
6. Respuesta: factura anulada + movimiento de reverso.

## 5. Tablas y relaciones
- **`Factura`** (nuevos campos): `anulada Boolean @default(false)`, `anuladaEn DateTime?`, `anuladoPor String?`, `motivoAnulacion String?`.
- **`CajaMovimiento`**: se anula el original y/o se crea uno de ajuste; ya existe `anulado/anuladoEn/anuladoPor/motivoAnulacion`.
- **`Cliente.saldo`** (opcional, según D1-b): devolver el saldo consumido.
- **`Mensualidad`** (opcional, según D1-c): revertir renovación automática.
- Relaciones: `Factura.ingresoId` / `Factura.mensualidadId` se conservan.

## 6. Permisos
- Nuevo endpoint `POST /api/facturas/:id/anular` con `verificarToken` + `verificarRol("admin")` (o admin+supervisor, a decidir).
- Validación de sucursal (no anular factura de otra sede).

## 7. Consecuencias en caja, facturas y reportes
- **Caja:** totales y cierre excluyen movimientos anulados (ya funciona). El ajuste en caja abierta mantiene el arqueo correcto.
- **Facturas:** listado muestra estado; PDF puede llevar marca de agua "ANULADA".
- **Reportes/Dashboard:** deben **excluir facturas anuladas** de ingresos (`factura.aggregate where anulada=false`). Hoy no existe el filtro → hay que añadirlo.

## 8. Errores y casos especiales
- Anular dos veces → 409 "ya anulada".
- Anular factura ajena a la sucursal → 403.
- Anular con caja cerrada → genera ajuste en caja actual (decidir) o bloquea (decidir **D1-a**).
- Anular factura de plan ya renovado → decidir **D1-c**.
- Anular factura con saldo → decidir **D1-b**.

## 9. Pruebas propuestas
- Anular factura vigente: deja `anulada=true`, movimiento revertido, excluida de totales y reportes.
- Anular dos veces: 409.
- Anular de otra sede: 403.
- Anular con caja cerrada: comportamiento definido (ajuste o bloqueo).
- Reportes: el total de ingresos baja tras anular.

## Subdecisiones D1 (además de D1 principal)
- **D1-a:** ¿se permite anular una factura cuya caja ya está cerrada? (recomendado: sí, con ajuste en caja actual a nivel admin).
- **D1-b:** ¿qué pasa con el saldo del cliente usado en esa factura? (devolver / no devolver).
- **D1-c:** ¿una anulación de factura de mensualidad revierte la renovación automática?
- **D1-d:** ¿puede anular el supervisor o solo el admin?

---

# PARTE 2 — D7 · CLIENTES GLOBALES CON ACCESO CONTROLADO POR SUCURSAL

## Recomendación aprobada
Modelo **mixto**: el cliente existe **una sola vez** (global), pero **la visibilidad y las operaciones se restringen por sucursal**.

## 1. Cómo funciona para el propietario
- Un cliente se registra una sola vez y puede usar varias sedes sin duplicarse.
- El admin ve **todos** los clientes y todas las sedes.
- Puede ver en qué sedes opera cada cliente.

## 2. Cómo funciona para el empleado
- Solo ve clientes con **relación en su sede** (los que tienen vehículo/ingreso/mensualidad/reserva/ausencia en su sede).
- Puede crear un cliente nuevo (el cliente nace global, pero se "vincula" a su sede al operarlo).
- No ve clientes que solo operan en otras sedes.

## 3. Cómo afecta al cliente
- No se duplica; puede llegar a otra sede y ser reconocido por su documento.
- Su historial se ve completo solo para el admin; cada sede ve lo suyo.

## 4. Flujo completo
1. Empleado de sede A busca por documento → no existe → crea el cliente (global).
2. El cliente queda vinculado a sede A (porque su vehículo/operación es de sede A).
3. Cliente va a sede B → empleado de B busca por documento → lo encuentra (global) → opera; ahora también queda vinculado a B.
4. Listado de clientes para empleado de A = clientes vinculados a A (+ los globales sin vincular, a decidir **D7-a**).
5. Admin ve todo.

## 5. Tablas y relaciones
- **`Cliente`**: opción sin cambios de estructura + cálculo de visibilidad por relaciones existentes; **o** nueva tabla de vínculo `ClienteSucursal (clienteId, sucursalId, desde)`.
- La visibilidad se puede derivar sin tabla nueva: un cliente "pertenece" a las sedes donde tiene vehículos/ingresos/mensualidades/reservas. **Recomendado: sin tabla nueva** (derivar), para no duplicar información.
- Si se requiere "cliente compartido explícitamente", se añade `ClienteSucursal`.

## 6. Permisos
- Filtro de visibilidad en `obtenerClientes`, `obtenerCliente`, `perfilCliente` según `resolverSucursalPermitida` + vínculo.
- Crear/editar cliente: cualquier rol autenticado (como hoy), pero edición de campos sensibles (saldo/bloqueado) sigue admin.
- **Eliminar/recargar:** admin (ya lo están).

## 7. Consecuencias en caja, facturas y reportes
- Las operaciones ya llevan su `sucursalId`; los reportes por sede no cambian.
- El listado de clientes para no-admin se filtra (cambio visible).
- No afecta caja ni facturas directamente.

## 8. Errores y casos especiales
- Cliente global sin vínculo a ninguna sede: ¿lo ven todos o nadie excepto admin? → **D7-a**.
- Empleado intenta abrir cliente de otra sede por URL directa → debe dar 403/404.
- Documento duplicado al crear en otra sede → se reutiliza el global (no error).

## 9. Pruebas propuestas
- Empleado de sede A no ve clientes exclusivos de sede B.
- Cliente con actividad en A y B: visible para ambos.
- Admin ve todos.
- Empleado no puede abrir por ID un cliente exclusivo de otra sede.

## Subdecisiones D7
- **D7-a:** ¿un cliente sin operaciones (global recién creado) lo ve cualquier sede o solo quien lo creó?
- **D7-b:** ¿`ClienteSucursal` (vínculo explícito) o visibilidad derivada por operaciones? (recomendado: derivada).

---

# PARTE 3 — D10 · RESERVAS INDEPENDIENTES CON DISPONIBILIDAD POR FECHAS

## Recomendación aprobada
Separar la **reserva** de la **ocupación física**: la reserva no marca el puesto ocupado; la disponibilidad se calcula por fecha/hora.

## 1. Cómo funciona para el propietario
- Puede tener varias reservas no solapadas del mismo puesto.
- El dashboard muestra reservas próximas sin "perder" el puesto para meses.
- Controla mejor la ocupación real.

## 2. Cómo funciona para el empleado
- Al crear una reserva, el puesto **no** se bloquea si la fecha es futura.
- El sistema avisa si hay solapamiento con otra reserva/mensualidad/ingreso en ese rango.
- Al llegar la ventana de la reserva (p. ej. ±X horas), el puesto pasa a RESERVADO.

## 3. Cómo afecta al cliente
- Puede reservar con antelación sin que el parqueadero "mate" el puesto.
- Si no llega, la reserva se libera (NO_SHOW / cancelada) según regla ya existente.

## 4. Flujo completo
1. Empleado crea reserva (puesto + fecha inicio/fin).
2. Sistema valida solapamiento contra **otras reservas**, mensualidades e ingresos del mismo rango (ya lo hace en `crearReserva`).
3. El puesto **no** cambia de estado si la reserva es futura (nuevo).
4. El estado del puesto `RESERVADO` solo se aplica:
   - Cuando `fechaInicio` está dentro de la ventana operativa (ej. hoy o dentro de N horas), **o**
   - Cuando se activa la reserva (crea ingreso) → OCUPADO.
5. Al cancelar/vencer → la disponibilidad se recalcula por fechas (el puesto sigue LIBRE si no hay otra reserva vigente).

## 5. Tablas y relaciones
- `Reserva` ya tiene `fechaInicio`/`fechaFin`/`puestoId`/`estado`. **No requiere nueva estructura** para la versión básica.
- El cambio es de **lógica**: el estado del puesto deja de fijarse en la creación para reservas futuras; pasa a calcularse por ventana temporal.
- Opcional: campo `Reserva.ventanaReservaHoras` o configuración global `reservaVentanaHoras`.

## 6. Permisos
- Sin cambios de rol; se mantiene admin/supervisor para mutaciones.

## 7. Consecuencias en caja, facturas y reportes
- Caja/facturas: sin cambios (las reservas no facturan hasta activarse).
- Reportes/dashboard: "puestos reservados" debe contar solo reservas **vigentes** (ventana activa), no todas las futuras.

## 8. Errores y casos especiales
- Dos reservas solapadas del mismo puesto → rechazado (ya existe la validación).
- Reserva futura + mensualidad del mismo puesto no solapada → permitido.
- Cliente no llega → scheduler ya libera; con D10, el puesto nunca estuvo "perdido".
- Reserva sin `fechaFin` → definir ventana (p. ej. 1 h) → ya existe el criterio en el scheduler.

## 9. Pruebas propuestas
- Reserva a 3 meses no marca el puesto RESERVADO (sigue LIBRE).
- Reserva dentro de la ventana sí lo marca.
- Dos reservas no solapadas del mismo puesto: ambas permitidas.
- Dos reservas solapadas: rechazada.
- No-show libera la disponibilidad.

## Subdecisiones D10
- **D10-a:** ¿cuál es la "ventana" para marcar el puesto RESERVADO? (ej. mismo día, o N horas antes; recomendado configurable, default 24 h).
- **D10-b:** ¿las reservas actuales (creadas con lógica vieja) se migran o conviven?

---

# COHERENCIA ENTRE D1, D7 Y D10

- **D1** afecta caja/reportes/facturas (ingresos). **D7** afecta visibilidad de clientes. **D10** afecta disponibilidad de puestos. No se contradicen.
- Punto de contacto: una **anulación** (D1) puede liberar un puesto o revertir una mensualidad; y una **reserva** (D10) depende de que el puesto esté realmente libre. Ninguna choca entre sí.
- Orden de implementación recomendado (coherente): **D10** (disponibilidad) → **D7** (visibilidad) → **D1** (anulación), porque D1 toca caja y conviene hacerla con el resto estable.

---

# QUÉ NECESITO QUE APRUEBES

| Decisión | Recomendación | Tu respuesta |
|---|---|---|
| D1 | Anulación con contrapartida + auditoría | ⬜ |
| D1-a | ¿Anular con caja cerrada? (recomendado sí, con ajuste) | ⬜ |
| D1-b | ¿Devolver saldo usado al anular? | ⬜ |
| D1-c | ¿Revertir renovación automática al anular? | ⬜ |
| D1-d | ¿Quién anula? (admin / admin+supervisor) | ⬜ |
| D7 | Clientes globales con visibilidad por sucursal | ⬜ |
| D7-a | ¿Cliente sin operaciones visible para todas las sedes? | ⬜ |
| D7-b | ¿Vínculo explícito o visibilidad derivada? (recomendado derivada) | ⬜ |
| D10 | Reservas por fechas, sin bloquear puesto futuro | ⬜ |
| D10-a | ¿Ventana para marcar RESERVADO? (recomendado 24 h configurable) | ⬜ |
| D10-b | ¿Migrar reservas existentes o convivir? | ⬜ |

# 10 — Auditoría de consistencia del negocio

> Análisis de coherencia entre funcionalidades: casos donde técnicamente puede pasar algo que operativamente es incorrecto. Se marca si es **confirmado en código** o **a definir**.

---

## 1. Plan vigente y cobro
**Escenario**: cliente con plan vigente.
- **Resultado esperado** (sí se cumple): `registrarSalidaConCobro` detecta `mensualidadVigente` → `cubiertoPorPlan = true`, `valorPagado = 0`, no crea factura ni movimiento.
- **Observación**: `simularCobro` también devuelve total 0 si hay plan. ✔ Consistente.
- **Riesgo operativo (a definir)**: si la mensualidad vence **entre** la simulación y la salida, el backend lo detecta (409 "La cobertura… cambió"). Correcto.

## 2. Puesto se libera incorrectamente
**Escenario**: vehículo sale y su puesto queda LIBRE aunque tenía plan/reserva.
- **Resultado** (código): al finalizar, se recalcula `estadoPuesto = otroIngresoActivo>0 ? OCUPADO : (mensualidadEnPuesto+reservaFutura>0 ? RESERVADO : LIBRE)`. ✔ No se libera si hay plan/reserva vigente.
- **Caso**: `liberarPuesto` (plan activo) → deja puesto físicamente libre pero conserva la asignación del plan. Documentado en el propio mensaje.
- **Riesgo operativo (MEDIO, a definir)**: en `liberarPuesto` el mensaje dice "puesto físicamente libre", pero el recálculo puede dejarlo RESERVADO. Dos conceptos ("libre físicamente" vs "asignado al plan") conviven y pueden confundir al operador.

## 3. Plan vencido mientras el vehículo está dentro — **CONFIRMADO**
**Escenario**: el plan vence con el vehículo aún estacionado.
- `scheduler.ts` (`vencerMensualidades`) marca la mensualidad `VENCIDA` y recalcula el puesto (potencialmente a LIBRE).
- **Pero el `Ingreso` de ese vehículo sigue `ACTIVO`** y no se convierte a cobro por tiempo automáticamente.
- **Consecuencia**: al registrar la salida, `registrarSalidaConCobro` **no** encontrará mensualidad vigente → cobrará por tarifa desde `fechaEntrada` (lo cual puede ser justo) **pero** el puesto pudo haberse liberado y ocupado por otro vehículo mientras el primero seguía dentro.
- **Riesgo**: CRÍTICO operativo — doble ocupación de un puesto y/o cobro sorpresa. Requiere definición de política (¿bloquear el puesto hasta la salida real? ¿cobrar plan + excedente?).

## 4. Renovación duplica pagos
- `renovarMensualidad` **crea una nueva mensualidad** sin crear factura ni cobro. El pago es un paso separado (`cobrarMensualidad`). ✔ No duplica por sí mismo.
- **Riesgo**: `cobrarMensualidad`, al saldar (`nuevoSaldo<=0`), **renueva la misma mensualidad** (no crea nueva) cambiando `fechaInicio/fechaFin`. Si además se usó `renovarMensualidad`, podrían coexistir dos mensualidades activas del mismo vehículo. El lock y las validaciones de solapamiento deberían impedirlo, pero es un área sensible (a revisar con prueba).

## 5. Factura no coincide con movimiento de caja
- En salidas: se crea `Factura` (valor `valorFinal`) y `CajaMovimiento` (monto `valorFinal`), mismo valor. ✔
- En suscripción: `Factura` (montoPagado) y movimiento con el mismo monto. ✔
- **Riesgo (BAJO)**: si `saldoUsado > 0`, la factura guarda el valor neto (`valorFinal`) y **no** el bruto; el movimiento también neto. El "descuento por saldo" no queda como línea separada → auditabilidad reducida.

## 6. Cierre de caja no coincide con operaciones
- `cerrarCaja` calcula `esperado = apertura + ingresosEfectivo − egresosEfectivo` sobre movimientos **no anulados**. ✔
- El cierre usa el lock global (78124019), igual que cobros y gastos → no puede cerrar mientras haya una salida/gasto en curso. ✔
- **Observación**: `cierre` guarda el valor esperado (no el conteo real); el conteo y la diferencia van dentro de `observacion` (JSON). A definir si la "diferencia" debería ser un campo propio para reportes.

## 7. Usuario ejecuta acción sin permiso
- Backend: `verificarRol` en todas las mutaciones sensibles. ✔
- **Riesgo (MEDIO)**: el frontend muestra botones/acciones a roles sin permiso (p. ej. "Eliminar" para empleado, rutas `/tarifas` y `/planes` sin guard) → el usuario recibe 403 confuso. No es fuga de datos (la API protege), pero es mala UX y expone la existencia de operaciones.

## 8. Registro eliminado deja relaciones incompletas
- **Cliente**: `eliminarCliente` con `forzar` cancela mensualidades/reservas y libera puestos huérfanos; no borra vehículos/ingresos (los suspende/bloquea). ✔ preserva historial.
- **Puesto**: `eliminarPuesto` bloquea si hay historial. ✔
- **Ingreso**: bloquea si tiene facturas. ✔
- **Mensualidad**: bloquea si tiene facturas. ✔
- **Usuario**: bloquea si tiene cajas/accesos. ✔
- **Riesgo (confirmado)**: `formatearSistema` borra en cascada manual (factura→…→configuracion) **conservando usuarios**; si algún `deleteMany` falla silenciosamente (tiene `try/catch` que ignora), podría dejar un estado parcial. El `try/catch` por modelo oculta errores.

## 9. Otras inconsistencias detectadas (a definir)

| # | Situación | Evidencia | Consecuencia |
|---|---|---|---|
| 9.1 | **Tipo de puesto no validado en backend** | `registrarIngreso` no compara `Puesto.tipoPuesto` con `Vehiculo.tipo`; solo el frontend (`PuestoAssignModal`) lo evita | Por API, un carro puede ocupar un puesto de moto |
| 9.2 | **Cambio de tarifa en caliente** | `calculadorCobros` lee la tarifa vigente al momento de la salida | Un vehículo estacionado puede pagar más/menos según cuándo se edite la tarifa; la simulación mostrada al ingresar no es vinculante |
| 9.3 | **Pérdida de propietario histórico** | `Vehiculo.clienteId` se sobreescribe | No se puede auditar a quién perteneció un vehículo |
| 9.4 | **`crear-admin` sin auth** | `usuarios.routes.ts` | Endpoint de bootstrap expuesto (mitigado por rate-limit + "solo un admin") |
| 9.5 | **Factura sin desglose** | `Factura` no guarda `tarifaId`/modalidad/minutos | No se puede reconstruir el cálculo del cobro |
| 9.6 | **Mensualidad cubre "todos los puestos" si `puestoId` es null** | `OR: [{puestoId:null},{puestoId:ingreso.puestoId}]` | Un plan sin puesto fijo cubre cualquier puesto → podría interactuar con reservas de otros |
| 9.7 | **Ausencia con ingreso activo cobra y libera sin validar plan** | `crearAusencia` calcula tarifa por horas y finaliza el ingreso | Si el vehículo tenía plan, ¿debería cobrar? Comportamiento a definir |
| 9.8 | **`actualizarIngreso` puede mover vehículo/puesto** | permitido si no viene de reserva | Puede alterar la trazabilidad de un ingreso activo |
| 9.9 | **`gastos` y `cobros` exigen caja abierta, pero la caja es por sucursal** | `getCajaOError(sucursalId)` | Un usuario sin sucursal asignada podría no poder operar; a verificar UX |
| 9.10 | **`movimientos.controller` define create/update/delete no enrutados** | rutas solo GET | Código muerto (no explotable) |

## 10. Situaciones "técnicamente válidas pero comercialmente dudosas"

- **Cobro de plan y cobro por tiempo en el mismo vehículo el mismo día**: si el plan vence estando dentro (caso 3), la salida cobra por tiempo completo desde la entrada. ¿Correcto comercialmente? A definir.
- **Saldo del cliente usado para pagar salidas** (no solo suscripciones): `registrarSalidaConCobro` consume saldo. ¿Es el saldo una "cuenta corriente" del cliente? A definir.
- **Cierre de cuenta del cliente** (`RETIRADO`): conserva facturas y saldo; ¿debería exigir saldo cero? A definir.
- **Ocupación** sin menú: funcional pero sin punto de entrada; ¿debe integrarse al Dashboard? A definir.
- **No hay control de aforo global** (capacidad máxima del parqueadero); la "capacidad" es solo de puestos. A definir.

---

## Resumen de consistencia
El sistema tiene **reglas financieras fuertes y bien implementadas** (facturas, caja, auditoría, concurrencia). Las inconsistencias se concentran en:
1. **Plan vencido con vehículo dentro** (crítico).
2. **Validación de tipo de puesto vs tipo de vehículo** (alto).
3. **Trazabilidad histórica** (propietarios, tarifas) y **desglose de factura** (medio).
4. **Consistencia de permisos UI vs API** (medio).
5. **Definiciones de negocio pendientes** (saldo, plan sin puesto, cobro por ausencia).

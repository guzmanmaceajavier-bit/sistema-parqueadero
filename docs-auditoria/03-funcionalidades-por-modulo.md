# 03 — Funcionalidades por módulo

> Una entrada por módulo con: qué hace, quién, entradas, validaciones, tablas, relaciones, éxito, error y estados.
> Evidencia en `backend/src/modules/<modulo>/`.

---

## 1. Usuarios — `modules/usuarios`
**Qué hace**: autenticación (login/logout/refresh), gestión de cuentas, recuperación de contraseña, registro de accesos.
**Quién**: login público; CRUD solo `admin`.
**Entradas**: `{usuario|correo, password}`; creación `{nombre, usuario, correo, password, rol, sucursalId}`.
**Validaciones**: `validate(loginSchema/crearUsuarioSchema/...)`; login con bcrypt; bloqueo 15 min tras 5 fallos; correo/usuario únicos; no degradar/desactivar/eliminar al último admin activo; no auto-quitarse admin; no eliminarse a sí mismo.
**Tablas**: `Usuario`, `Acceso`, `Sucursal`, `Movimiento`.
**Éxito**: login → cookie JWT + datos de usuario; creación → 201.
**Error**: 401 "Credenciales incorrectas", 403 "Ya existe un administrador", 409 "No puedes degradar al último administrador activo", 409 "El usuario tiene registros de caja o accesos asociados…", 400 "El usuario o correo ya existe".
**Estados**: `estado` (bool), `bloqueadoHasta`, `tokenVersion`, `resetToken`.

## 2. Configuración — `modules/configuracion`
**Qué hace**: parámetros globales (identidad, tema, formatos, notificaciones, mensajes WhatsApp, operativa, seguridad, listas), subida de logo/fondo, formateo del sistema.
**Quién**: lectura pública parcial; guardar admin/supervisor; formatear solo admin.
**Validaciones**: `actualizarConfiguracionSchema`; whitelist de 40+ campos (`CAMPOS_CONFIG`); formatear exige `confirmacion === "FORMATEAR"`; multer valida tipo/tamaño de imagen.
**Tablas**: `Configuracion` (registro único); formatear borra en orden `factura→ingreso→mensualidad→reserva→ausencia→gasto→movimiento→caja→acceso→tarifa→plan→puesto→vehiculo→cliente→configuracion` (**conserva usuarios**).
**Éxito**: 200 "Configuración actualizada/creada"; "Sistema formateado…".
**Error**: 400 "Debes escribir FORMATEAR…"; 400 por imagen inválida.
**Nota de riesgo**: `POST /configuracion/formatear` es destructivo (ver documento 12).

## 3. Clientes — `modules/clientes`
**Qué hace**: CRUD de clientes, perfil, importación masiva, recarga de saldo, cierre de cuenta ("retiro"), consulta de bloqueos.
**Quién**: ver/crear/editar cualquier autenticado; eliminar/importar/recargar con roles restringidos.
**Validaciones**: documento único; cierre bloqueado si hay vehículo dentro (400) o pendientes (409, cancela con `forzar`); recarga exige `monto > 0`.
**Tablas**: `Cliente`, `Vehiculo`, `Reserva`, `Mensualidad`, `Ingreso`, `Caja`, `CajaMovimiento`, `Movimiento`.
**Éxito**: 201 crear; "Cliente retirado. Historial conservado."
**Error**: 404 no encontrado; 400 documento duplicado; 409 pendientes.
**Estados cliente**: `ACTIVO` / `VENCIDO` (auto si mensualidad vencida) / `SUSPENDIDO` / `MOROSO` / `RETIRADO` + `bloqueado`.

## 4. Vehículos — `modules/vehiculos`
**Qué hace**: CRUD de vehículos; asociación a cliente; tipo de cobro (plan/tarifa).
**Validaciones**: placa única (error con nombre del dueño); cliente existente; plan/tarifa existentes; aislamiento por sucursal.
**Tablas**: `Vehiculo`, `Cliente`, `Plan`, `Tarifa`, `Ingreso`, `Mensualidad`, `Reserva`, `Ausencia`, `Movimiento`.
**Éxito**: 201 crear (incluye cliente/plan/tarifa).
**Error**: 400 "La placa X ya pertenece a <dueño>".
**Estados**: `estado` (bool, suspendido si tiene historial), `bloqueado`, `tipoCobro`.

## 5. Puestos — `modules/puestos`
**Qué hace**: gestión de puestos, creación masiva, estados, toggle.
**Validaciones**: código único; no liberar/desactivar con ingresos/mensualidades/reservas activas; no eliminar con historial.
**Tablas**: `Puesto`, `Ingreso`, `Mensualidad`, `Reserva`.
**Éxito**: 201 "X puestos creados".
**Error**: 400 "El puesto ya existe"; 409 "No se puede eliminar un puesto con historial…"; 400 "No se puede marcar un puesto como OCUPADO desde este endpoint…".
**Estados**: `LIBRE`, `OCUPADO`, `RESERVADO`, `MANTENIMIENTO`, `AUSENCIA`; `activo`.

## 6. Ingresos — `modules/ingresos`
**Qué hace**: entrada, salida con cobro, simulación de cobro, liberar puesto (plan), edición, eliminación, ticket PDF.
**Validaciones**: cliente/vehículo válidos, no bloqueados, misma sucursal; vehículo ya dentro → rechazo; reserva/mensualidad fijan puesto; transacción con advisory locks por vehículo/puesto + puesto libre; cobertura de plan revalidada; saldo del cliente bloqueado `FOR UPDATE`.
**Tablas**: `Ingreso`, `Puesto`, `Reserva`, `Mensualidad`, `Factura`, `Caja`, `CajaMovimiento`, `Cliente`, `Tarifa`, `Ausencia`, `Movimiento`.
**Éxito**: 201 entrada (`tipoIngreso`: normal/reserva/plan_mensual); salida → factura + movimiento de caja; con plan → cobro 0.
**Error**: 400 "El vehículo con placa X ya se encuentra dentro…"; 409 "El puesto acaba de ser asignado…"; 409 "La cobertura de la mensualidad cambió…"; 400 "No hay caja abierta"; 400 "El vehículo no tiene plan activo…".
**Estados ingreso**: `ACTIVO` → `FINALIZADO`.

## 7. Tarifas — `modules/tarifas`
**Qué hace**: precios por tiempo (modalidades y progresivas).
**Validaciones**: nombre/tipo/modalidad requeridos; `valor > 0`; primera hora y hora adicional deben ir juntas.
**Tablas**: `Tarifa`, `Vehiculo`, `Movimiento`.
**Estados**: `activa` (bool). DELETE **desactiva** (no borra).
**Error**: 400 "Valor debe ser un número válido y positivo"; 400 "Configura juntos el precio de la primera hora…".

## 8. Dashboard — `modules/dashboard`
**Qué hace**: KPIs y series (ocupación, ingresos día/semana/mes, gastos, utilidad, morosos, reservas, métodos de pago, top vehículos, ingresos por hora/mes).
**Quién**: cualquier autenticado (aislado por sucursal).
**Validaciones**: `filtro` ∈ {hoy, semana, mes}; zona horaria de config.
**Tablas**: `Puesto`, `Ingreso`, `Factura`, `Gasto`, `Mensualidad`, `Cliente`, `Vehiculo`, `Movimiento`, `Ausencia`, `Caja`, `Reserva`, `Configuracion` (+ SQL raw top vehículos).
**Error**: 400 "El período del dashboard no es válido".

## 9. Caja — `modules/caja`
**Qué hace**: abrir/cerrar caja con arqueo, movimientos, anulación, edición.
**Validaciones**: apertura con contraseña (bcrypt); una caja abierta por sucursal; cierre valida denominaciones; cajas cerradas inmutables; movimientos de caja cerrada no editables/anulables; movimientos ligados a factura/gasto solo desde su módulo.
**Tablas**: `Caja`, `CajaMovimiento`, `Usuario`, `Factura`, `Gasto`.
**Éxito**: 201 caja abierta; cierre → `{cierre, totalConteo, esperado, diferencia}`.
**Error**: 400 "Ya hay una caja abierta"; 401 "Contraseña incorrecta"; 409 caja cerrada/inmutable.
**Estados**: `ABIERTA`/`CERRADA`; movimiento `anulado` (soft-delete con anuladoEn/Por/motivo).

## 10. Mensualidades — `modules/mensualidades`
**Qué hace**: suscripciones (plan + puesto), cobro con abonos, renovación, cancelación, eliminación, generación de facturas pendientes.
**Validaciones**: cliente/vehículo/puesto válidos y misma sucursal; conflictos de periodo; no editar/eliminar con facturas emitidas; cobro ≤ saldo pendiente; exige caja abierta; al saldar renueva por `plan.duracionDias`.
**Tablas**: `Mensualidad`, `Cliente`, `Vehiculo`, `Plan`, `Puesto`, `Ingreso`, `Reserva`, `Factura`, `Caja`, `CajaMovimiento`, `Ausencia`, `Movimiento`.
**Éxito**: 201 crear; cobro → factura `FACT-MEN` + movimiento.
**Error**: 409 "El vehículo ya tiene una mensualidad que se cruza…"; 409 "El puesto tiene otra ocupación…"; 409 "No se pueden cambiar … con facturas emitidas"; 400 "El monto excede el saldo pendiente".
**Estados**: `ACTIVA`/`VENCIDA`/`CANCELADA`; origen factura `MENSUALIDAD`/`MENSUALIDAD_AUTO`.

## 11. Gastos — `modules/gastos`
**Qué hace**: egresos con recurrentes, vinculados a caja.
**Validaciones**: concepto requerido; exige caja abierta; recurrente exige periodicidad; no modificar/eliminar gasto de caja cerrada; eliminar anula movimientos (los conserva); `generarRecurrentes` con claim optimista.
**Tablas**: `Gasto`, `Caja`, `CajaMovimiento`, `Movimiento`.
**Error**: 400 "Concepto es requerido"; 409 "La caja se cerró antes de registrar el gasto"; 400 "Periodicidad no válida…".

## 12. Reservas — `modules/reservas`
**Qué hace**: reserva de puesto con fecha y validación de solapamientos; activación crea ingreso.
**Validaciones**: fecha futura; vehículo/puesto válidos; sin doble reserva activa; conflictos con mensualidad/ingreso bajo locks; edición solo PENDIENTE/CONFIRMADA.
**Tablas**: `Reserva`, `Cliente`, `Vehiculo`, `Puesto`, `Ingreso`, `Mensualidad`, `Movimiento`.
**Éxito**: 201 reserva; activar → ingreso creado.
**Error**: 400 "El vehículo ya tiene una reserva activa…"; 409 "El puesto ya tiene una reserva en ese rango".
**Estados**: `PENDIENTE`→`CONFIRMADA`→`ACTIVA`→`FINALIZADA`; `CANCELADA`/`NO_SHOW`.

## 13. Ausencias — `modules/ausencias`
**Qué hace**: ausencia de un vehículo; al finalizar aplica opción sobre la mensualidad.
**Validaciones**: cliente/vehículo requeridos y relacionados; si hay ingreso activo exige caja abierta y cierra ingreso con factura.
**Tablas**: `Ausencia`, `Cliente`, `Vehiculo`, `Ingreso`, `Factura`, `Tarifa`, `Caja`, `Puesto`, `Mensualidad`, `Movimiento`.
**Opciones**: `CONGELAR`/`EXTENDER` (extienden fechaFin), `DESCONTAR` (valor/30 por día), `MANTENER`, `HISTORIAL`.
**Estados**: `ACTIVA`→`FINALIZADA`; puesto puede quedar `AUSENCIA`.

## 14. Alertas — `modules/alertas`
**Qué hace**: alertas derivadas (morosos, mensualidades vencidas/por vencer, vehículos +8h, reservas próximas, caja cerrada, ausencias).
**Tablas**: `Cliente`, `Mensualidad`, `Ingreso`, `Reserva`, `Caja`, `Ausencia`. Solo lectura.

## 15. Planes — `modules/planes`
**Qué hace**: planes de suscripción (duración/valor/tipo).
**Validaciones**: duración > 0, valor > 0.
**Tablas**: `Plan`, `Mensualidad`, `Movimiento`.
**Estados**: `activo` (bool). DELETE desactiva si hay mensualidades activas.

## 16. Movimientos — `modules/movimientos`
**Qué hace**: bitácora de auditoría (solo lectura enrutada).
**Tablas**: `Movimiento`.

## 17. Facturas — `modules/facturas`
**Qué hace**: listado/detalle, PDF, recibo, WhatsApp. **Sin creación/edición** (nacen en ingresos/mensualidades/ausencias).
**Validaciones**: aislamiento por sucursal; teléfono requerido para WhatsApp.
**Tablas**: `Factura`, `Ingreso`, `Mensualidad`, `Configuracion`.

## 18. Backup — `modules/backup`
**Qué hace**: exportar JSON (14 colecciones, **sin contraseñas**) y restaurar (upsert).
**Validaciones**: `data` requerido; usuarios sin contraseña reciben clave aleatoria.
**Tablas**: todas las principales.

## 19. Notificaciones — `modules/notificaciones`
**Qué hace**: suscripción push (web-push) y envío.
**Tablas**: `PushSubscription`.

## 20. Sucursales — `modules/sucursales`
**Qué hace**: CRUD de sucursales (multi-sede). Solo admin.
**Tablas**: `Sucursal`.

## 21. Reportes — `modules/reportes`
**Qué hace**: resumen por rango (ingresos/gastos/utilidad/ocupación/métodos), facturas y gastos.
**Validaciones**: periodo válido; zona horaria de config; aislamiento por sucursal.
**Tablas**: `Factura`, `Gasto`, `Ingreso`, `Puesto`, `Configuracion`.

---

## Servicios/helpers transversales
- `calculadorCobros.ts`: motor de cobro (ver documento 05).
- `facturaCounter.ts`: consecutivos `PREFIJO-000001` vía secuencia Postgres.
- `scheduler.ts`: cada 10 min vence reservas y mensualidades, envía recordatorios.
- `helpers/caja.ts`: caja abierta y totales; `getCajaOError` lanza "Caja cerrada".
- `helpers/movimientos.ts`: auditoría (nunca lanza).
- `utils/sucursalAccess.ts`: aislamiento multi-sucursal.

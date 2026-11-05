# 12 — Hallazgos y recomendaciones

> Clasificación: **CRÍTICO** · **ALTO** · **MEDIO** · **BAJO** · **PENDIENTE DE DEFINICIÓN**.
> Cada hallazgo diferencia **error confirmado** (verificado en código) de **recomendación**.
> No se modificó código.

---

## CRÍTICO

### H1 — Plan vencido con el vehículo dentro deja estados inconsistentes · *Error confirmado*
- **Módulo**: mensualidades / scheduler / ingresos.
- **Evidencia**: `scheduler.ts` `vencerMensualidades()` marca la mensualidad `VENCIDA` y recalcula el puesto a LIBRE/RESERVADO, pero **no cierra ni convierte el `Ingreso` ACTIVO** de ese vehículo.
- **Consecuencia**: el puesto puede liberarse y ocuparse por otro vehículo mientras el primero sigue físicamente dentro; la salida posterior cobra por tiempo desde `fechaEntrada`.
- **Solución propuesta**: al vencer una mensualidad con ingreso activo, bloquear el puesto (estado que refleje "ocupado por plan vencido") y definir política de cobro (plan hasta el vencimiento + excedente por tarifa). Requiere definición de negocio.
- **Dependencias**: ingresos, puestos, caja, facturación.

## ALTO

### H2 — Tipo de puesto no validado en backend · *Error confirmado*
- **Evidencia**: `registrarIngreso` no compara `Puesto.tipoPuesto` con `Vehiculo.tipo` (solo lo hace `PuestoAssignModal` en frontend).
- **Consecuencia**: vía API un carro puede ocupar un puesto de moto.
- **Solución**: validar en `registrarIngreso`/`actualizarIngreso` que el tipo de vehículo esté incluido en `tipoPuesto` (que es multi-valor separado por comas).

### H3 — `crear-admin` sin autenticación · *Error confirmado (mitigado)*
- **Evidencia**: `POST /api/usuarios/crear-admin` sin `verificarToken`; protegido por rate-limit 3/h y por el advisory lock "solo un admin".
- **Consecuencia**: superficie de ataque para bootstrap; si la lógica de "ya existe admin" fallara, permitiría crear un admin.
- **Solución**: restringir a entorno sin admin (o token de bootstrap por variable de entorno); dejar de exponerlo una vez hay admin.

### H4 — Permisos visuales inconsistentes con la API · *Error confirmado (UX/seguridad)*
- **Evidencia**: rutas `/tarifas` y `/planes` accesibles por `empleado` (sin guard) aunque la API exige admin; botones "Eliminar" visibles a roles sin permiso.
- **Consecuencia**: 403 confusos; exposición de operaciones.
- **Solución**: aplicar `allowedRoles` en frontend (tarifas/planes → admin/supervisor; ocultar botones destructivos según rol).

## MEDIO

### H5 — Sin trazabilidad histórica de propietarios y tarifas · *Recomendación*
- **Evidencia**: `Vehiculo.clienteId` se sobreescribe; `Factura` no guarda `tarifaId`/desglose.
- **Consecuencia**: imposible auditar dueño anterior o reconstruir el cálculo del cobro.
- **Solución**: tabla de historial de propietarios; guardar snapshot del cálculo en la factura.

### H6 — Cambio de tarifa en caliente · *Pendiente de definición*
- **Evidencia**: `calculadorCobros` usa la tarifa vigente al momento de la salida.
- **Consecuencia**: el precio al ingresar puede diferir del cobrado.
- **Solución**: definir política (¿congelar tarifa al ingresar?). Requiere decisión de negocio.

### H7 — Saldo del cliente con semántica ambigua · *Pendiente de definición*
- **Evidencia**: `saldo` se usa para pagar salidas y suscripciones; recarga manual; no hay libro de movimientos de saldo.
- **Solución**: definirlo como cuenta corriente con historial, o restringir su uso.

### H8 — `formatearSistema` con errores silenciados · *Error confirmado*
- **Evidencia**: `configuracion.controller.ts` itera con `try/catch` que ignora fallos por modelo.
- **Consecuencia**: un borrado parcial podría reportarse como exitoso.
- **Solución**: acumular errores y reportarlos; abrir transacción o confirmar por tabla.

### H9 — Ausencia con plan activo cobra sin considerar el plan · *Pendiente de definición*
- **Evidencia**: `crearAusencia` finaliza el ingreso cobrando por tarifa/horas.
- **Solución**: definir si una ausencia con plan debe cobrar o solo registrar.

### H10 — Validaciones ausentes en sucursales · *Error confirmado (menor)*
- **Evidencia**: `sucursales.routes.ts` no usa `validate(schema)` ni `validateIdParam`.
- **Solución**: agregar esquemas Zod y validación de id.

## BAJO

### H11 — Código muerto · *Recomendación*
- `clientes.service.ts`, `puestos.service.ts`, `vehiculos.service.ts` (funciones destructivas sin uso); `movimientos.controller` define create/update/delete no enrutados; `constants/vehiculo.ts` (AKT `"akT"` inconsistente); `ForgotPassword.tsx` es un stub.

### H12 — Endpoints sin `validateIdParam` · *Recomendación*
- `PUT /usuarios/:id` y `DELETE /usuarios/:id` no validan el id con el middleware.

### H13 — Cierre de caja guarda esperado, no conteo · *Recomendación*
- La diferencia queda dentro de `observacion` (JSON), no como campo consultable.

### H14 — Multi-sucursal incompleto en reportes/ciertas consultas · *Recomendación*
- Algunas consultas usan `sucursalId` opcional; conviene auditar consistencia del aislamiento en cada módulo.

## PENDIENTE DE DEFINICIÓN (negocio)

| # | Tema | Pregunta |
|---|---|---|
| D1 | Cobro de plan vencido con vehículo dentro | ¿Plan hasta vencimiento + excedente? ¿Bloquear puesto? |
| D2 | Saldo del cliente | ¿Cuenta corriente con historial? ¿Solo suscripciones? |
| D3 | Cierre de cuenta (`RETIRADO`) | ¿Exigir saldo cero? ¿Conservar deuda? |
| D4 | Cobro por ausencia con plan | ¿Cobra? ¿Congela? |
| D5 | Plan sin puesto fijo | ¿Cubre cualquier puesto? ¿Riesgo con reservas? |
| D6 | Aforo global | ¿Capacidad máxima del parqueadero? |
| D7 | Ocupación en menú | ¿Agregar entrada o mover al Dashboard? |
| D8 | Reglas de edición de ingreso activo | ¿Permitir mover vehículo/puesto? |
| D9 | IVA (`config.iva`) | ¿Aplica a facturas? (el campo existe; no se ve cálculo en `calculadorCobros`) |

## Recomendaciones ordenadas por prioridad

1. **H1** (crítico): política de plan vencido con vehículo dentro.
2. **H2** (alto): validar tipo de puesto vs tipo de vehículo en backend.
3. **H3/H4** (alto): endurecer `crear-admin` y permisos de UI.
4. **H8** (medio): reportar errores reales en `formatearSistema`.
5. **H5/H6/H7** (medio): trazabilidad y definiciones de negocio.
6. **H11-H14** (bajo): limpieza y consistencia.
7. **Cobertura de pruebas**: agregar pruebas para CRUD, permisos por endpoint, flujo de suscripciones, backup/restore (documento 11).

> Todos los hallazgos citan archivos existentes. Los marcados "pendiente de definición" **no** tienen una respuesta única en el código: requieren decisión del dueño del negocio.

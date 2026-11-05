# 07 — Roles y permisos

> Roles reales: **admin**, **supervisor**, **empleado** (`Usuario.rol`, default "empleado").
> No existe rol "cliente" ni "propietario" (el propietario equivale al admin).

## 1. Resumen de roles

| Rol | Descripción | Menús visibles |
|---|---|---|
| **admin** | Control total. Equivale al propietario/administrador del negocio. | Todo (Dashboard, Clientes, Parqueadero, Mov.Entrada, Suscripciones, Caja, Auditoría, Configuración completa incl. Usuarios/Sucursales/Backup). |
| **supervisor** | Operación + finanzas + configuración, sin gestión de usuarios/sucursales/backup. | Todo excepto Usuarios, Sucursales, Backup. |
| **empleado** | Operación básica (registro y consulta). Sin finanzas ni configuración. | Dashboard, Clientes, Vehículos, Puestos, Ingresos, Reservas, Suscripciones, Ausencias, Caja, Facturas, Gastos. |

## 2. Matriz de permisos por acción (backend real)

Leyenda: ✅ permitido · ❌ 403 · — acción inexistente.

| Acción (endpoint) | admin | supervisor | empleado |
|---|---|---|---|
| Login / logout / perfil | ✅ | ✅ | ✅ |
| Listar clientes/vehículos/puestos/ingresos | ✅ | ✅ | ✅ |
| Crear/editar cliente | ✅ | ✅ | ✅ |
| Eliminar cliente (`DELETE /clientes/:id`) | ✅ | ❌ | ❌ |
| Ver bloqueos de cliente | ✅ | ❌ | ❌ |
| Recargar saldo | ✅ | ❌ | ❌ |
| Importar clientes | ✅ | ✅ | ❌ |
| Crear/editar vehículo | ✅ | ✅ | ❌ |
| Eliminar vehículo | ✅ | ❌ | ❌ |
| Crear/editar/masivos/toggle puesto | ✅ | ✅ | ❌ |
| Eliminar puesto | ✅ | ❌ | ❌ |
| Registrar ingreso / salida / simular / liberar / editar ingreso | ✅ | ✅ | ❌ |
| Eliminar ingreso | ✅ | ❌ | ❌ |
| Ticket entrada | ✅ | ✅ | ✅ |
| Crear/editar/eliminar tarifa | ✅ | ❌ | ❌ |
| Ver tarifas | ✅ | ✅ | ✅ |
| Crear/editar/eliminar plan | ✅ | ❌ | ❌ |
| Ver planes | ✅ | ✅ | ✅ |
| Abrir/cerrar caja, movimientos | ✅ | ✅ | ❌ |
| Editar/eliminar caja | ✅ | ❌ | ❌ |
| Crear/cobrar/renovar/cancelar/eliminar/editar mensualidad | ✅ | ✅ | ❌ |
| Ver mensualidades | ✅ | ✅ | ✅ |
| Crear/editar/eliminar gasto, generar recurrentes | ✅ | ✅ | ❌ |
| Ver gastos | ✅ | ✅ | ✅ |
| Crear/editar/cancelar/eliminar/activar reserva | ✅ | ✅ | ❌ |
| Ver reservas | ✅ | ✅ | ✅ |
| Crear/editar/finalizar ausencia | ✅ | ✅ | ❌ |
| Eliminar ausencia | ✅ | ❌ | ❌ |
| Ver facturas / PDF / WhatsApp | ✅ | ✅ | ✅ |
| Reportes | ✅ | ✅ | ❌ |
| Movimientos/auditoría | ✅ | ✅ | ❌ |
| Configuración (guardar/logo/fondo) | ✅ | ✅ | ❌ |
| Formatear sistema | ✅ | ❌ | ❌ |
| Usuarios (CRUD/estado/accesos) | ✅ | ❌ | ❌ |
| Sucursales (CRUD) | ✅ | ❌ | ❌ |
| Backup (generar/restaurar) | ✅ | ❌ | ❌ |

## 3. Permisos en el frontend

- **Sidebar** (`Sidebar.tsx`): sección "Auditoria" y "Configuracion" solo si `isAdmin || isSupervisor`; "Usuarios", "Sucursales", "Backup" solo si `isAdmin`.
- **ProtectedRoute** (`AppRouter.tsx`):
  - `/reportes`, `/movimientos`, `/configuracion`: `allowedRoles={["admin","supervisor"]}`.
  - `/usuarios`, `/sucursales`, `/backup`: `allowedRoles={["admin"]}`.
- **AuthContext**: expone `isAdmin`, `isSupervisor`, `isEmpleado`.

## 4. Diferencias entre permiso visual y permiso real (hallazgos)

| Ruta frontend | Menú visible para | Guard de rol en frontend | Rol real backend | Riesgo |
|---|---|---|---|---|
| `/tarifas` | admin/supervisor | **ninguno** (autenticado) | **solo admin** | Empleado puede abrir la pantalla; al operar recibe 403. La vista carga datos (GET permitido a autenticados). |
| `/planes` | admin/supervisor | **ninguno** | **solo admin** | Igual que tarifas. |
| `/ocupacion` | sin menú | ninguno | autenticado (GET puestos) | Accesible por URL para cualquier rol. |
| `/clientes` (eliminar) | botón visible para todos | — | **solo admin** | El botón "Eliminar" aparece para empleado; al pulsar recibe 403. |
| `/vehiculos` (eliminar), `/ausencias` (eliminar), `/ingresos` (eliminar) | botón visible | — | solo admin (vehículo/ingreso) / admin (ausencia) | Igual patrón: acción visible, rechazada por API. |

**Conclusión**: el backend es la autoridad (los `verificarRol` protegen correctamente), pero el **frontend no oculta consistentemente** las acciones que el rol no puede ejecutar, lo que produce errores 403 visibles al usuario en varios botones.

## 5. Endpoints públicos / sin autenticación
- `POST /api/usuarios/login`, `/forgot-password`, `/reset-password`, `/refresh-token`.
- `POST /api/usuarios/crear-admin` — **sin `verificarToken`**; protegido solo por rate-limit (3/h) y por la regla de "solo un admin" (advisory lock). Es un endpoint de bootstrap (ver documento 12).
- `GET /api/configuracion` con `verificarTokenOpcional` (devuelve versión pública si no hay sesión).
- `GET /api/usuarios/perfil` con `verificarTokenOpcional`.
- `GET /` (health).

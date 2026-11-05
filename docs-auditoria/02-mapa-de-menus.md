# 02 — Mapa de menús y navegación

> Fuente: `frontend/src/components/Sidebar.tsx`, `frontend/src/routes/AppRouter.tsx`.
> El frontend usa **HashRouter**: la URL real es `dominio/#/<ruta>`.

## 1. Estructura del menú lateral (Sidebar)

El sidebar solo se renderiza si `isAuthenticated`. Tiene dos modos (expandido / colapsado) con los mismos ítems.

| Sección | Ícono | Visible para | Submenú |
|---|---|---|---|
| **Dashboard** (ítem directo) | LayoutDashboard | todos | — |
| **Clientes** | Users | todos | Registro (`/clientes`), Vehiculos (`/vehiculos`) |
| **Parqueadero** | LayoutGrid | todos | Puestos (`/puestos`) |
| **Mov. Entrada** | LogIn | todos | Entradas / Salidas (`/ingresos`), Reservas (`/reservas`) |
| **Suscripciones** | CalendarClock | todos | Suscripciones (`/mensualidades`), Ausencias (`/ausencias`) |
| **Caja** | Wallet | todos | Estado (`/caja`), Facturas (`/facturas`), Gastos (`/gastos`) |
| **Auditoria** | ArrowRightLeft | admin, supervisor | Movimientos (`/movimientos`), Reportes (`/reportes`) |
| **Configuracion** | Settings | admin, supervisor | Precios por Tiempo (`/tarifas`), Planes (`/planes`), Usuarios* (`/usuarios`), Sucursales* (`/sucursales`), Backup* (`/backup`), General (`/configuracion`) |

`*` = solo visible para `admin` (`{isAdmin && ...}`).

**Pie del sidebar** (modo expandido): nombre de usuario, rol, botón modo oscuro, botón cerrar sesión (abre modal "Cerrar Sesion" → No / Sí salir).

**No aparece en el menú**: la ruta `/ocupacion` existe y es accesible por URL, pero no tiene entrada en el Sidebar (ver hallazgo en documento 12).

## 2. Tabla completa de rutas

| Ruta (hash) | Página | Restricción de acceso | Menú |
|---|---|---|---|
| `/` | Login (GuestRoute) | solo invitados | — |
| `/forgot-password` | ForgotPassword | pública (redirige a `/?modo=recuperar`) | — |
| `/reset-password` | ResetPassword | pública (token por query) | — |
| `/dashboard` | DashboardPage | autenticado | Dashboard |
| `/clientes` | Clientes | autenticado | Clientes → Registro |
| `/clientes/:id/perfil` | PerfilCliente | autenticado | (accesible desde Clientes) |
| `/vehiculos` | Vehiculos | autenticado | Clientes → Vehiculos |
| `/puestos` | Puestos | autenticado | Parqueadero → Puestos |
| `/ingresos` | Ingresos | autenticado | Mov. Entrada |
| `/tarifas` | Tarifas | **autenticado (sin rol)** ⚠ | Configuracion |
| `/planes` | Planes | **autenticado (sin rol)** ⚠ | Configuracion |
| `/caja` | Caja | autenticado | Caja → Estado |
| `/gastos` | Gastos | autenticado | Caja → Gastos |
| `/mensualidades` | Mensualidades | autenticado | Suscripciones |
| `/reservas` | Reservas | autenticado | Mov. Entrada → Reservas |
| `/ausencias` | Ausencias | autenticado | Suscripciones → Ausencias |
| `/ocupacion` | Ocupacion | autenticado | **sin entrada de menú** |
| `/facturas` | Facturas | autenticado | Caja → Facturas |
| `/reportes` | Reportes | admin, supervisor | Auditoria |
| `/movimientos` | Movimientos | admin, supervisor | Auditoria |
| `/configuracion` | Configuracion | admin, supervisor | Configuracion → General |
| `/usuarios` | Usuarios | **admin** | Configuracion → Usuarios |
| `/sucursales` | Sucursales | **admin** | Configuracion → Sucursales |
| `/backup` | BackupPage | **admin** | Configuracion → Backup |

## 3. Detalle por menú: componentes, acciones y permisos

### 3.1 Dashboard (`/dashboard`)
- **Componentes**: `KpiCard`, `WeeklyChart`, `HourlyChart`, `VehicleTypeChart`, `OcupacionDashboard`, `WhatsAppModal`.
- **Botones**: filtros Hoy / Esta Semana / Este Mes; selector de sucursal; quickActions (Nuevo Ingreso → `/ingresos`, Nuevo Cliente → `/clientes`, Abrir Caja → `/caja`, Nuevo Puesto → `/puestos`); enlaces "Ver suscripciones", "Gestionar ausencias"; `Reintentar` en error.
- **Endpoints**: `GET /dashboard?filtro=&sucursalId=`, `GET /puestos?all=true`, `GET /sucursales`.
- **Tablas/formularios**: ninguno (solo lectura).

### 3.2 Clientes (`/clientes`)
- **Botones**: `Exportar`, `Importar`, `Nuevo Cliente`; por fila: Perfil, Editar, Renovar plan, WhatsApp, Eliminar, (+ recargar saldo).
- **Formularios**: alta/edición de cliente (nombres, apellidos, documento, teléfono, correo, estado, dirección, observaciones, bloqueo) + vehículos dinámicos + opciones Suscripción/Reserva/Ingreso.
- **Filtros/buscador**: búsqueda por nombre/documento/placa; filtros estado y condición (con/sin plan, reserva, vehículo); tarjetas por estado.
- **Modales**: Importar, Renovar plan, Recargar saldo, ConfirmDialog (eliminar/retirar, con caso "Vehículo dentro").
- **Permisos**: ver/crear/editar cualquier rol autenticado; **eliminar** solo `admin` (backend `verificarRol("admin")`); importar admin/supervisor.

### 3.3 Vehículos (`/vehiculos`)
- **Botones**: `Exportar`, `Nuevo Vehículo`; por fila Editar, Eliminar.
- **Formulario**: placa, marca, modelo, tipo, clase, color, propietario, tipo de cobro (NINGUNO/PLAN/TARIFA), observaciones, bloqueo.
- **Permisos**: crear/editar admin+supervisor; eliminar solo admin.

### 3.4 Puestos (`/puestos`)
- **Botones**: `Exportar`, `Nuevo Puesto`, `Crear Masivos`; por puesto (detail modal): editar, liberar, mantenimiento, finalizar ausencia, asignar, eliminar.
- **Subcomponentes**: `PuestoCard`, `PuestoFormModal`, `PuestoBulkModal`, `PuestoDetailModal`, `PuestoAssignModal`.
- **Filtros**: tipo, zona, búsqueda por código/tipo; tarjetas por estado.
- **Permisos**: crear/editar/masivos/toggle admin+supervisor; eliminar solo admin.

### 3.5 Ingresos / Salidas (`/ingresos`)
- **Botones**: `Exportar`, `Registrar Entrada`; por fila: Salida, Editar/Entrada, Ticket, Eliminar.
- **Modal Entrada**: Cliente, Vehículo, Puesto (auto-fijado si hay plan/reserva).
- **Modal Salida**: resumen, checkbox "Perdió el ticket", desglose de cobro, Plan Activo (sin cobro), método de pago, cálculo de vuelto.
- **Permisos**: crear/editar/salida/liberar admin+supervisor; eliminar solo admin.

### 3.6 Reservas (`/reservas`)
- **Botones**: `Exportar`, `+ Nueva Reserva`; en detalle: Asignar puesto, Confirmar, Activar ingreso, Finalizar, Editar, Cancelar, Eliminar, WhatsApp.
- **Formulario**: cliente, vehículo (+ alta rápida), puesto, fechas inicio/fin, observaciones.
- **Permisos**: todas las mutaciones admin+supervisor.

### 3.7 Suscripciones (`/mensualidades`)
- **Botones**: `Exportar`, `Generar facturas`, `Nueva Suscripción`; por fila: Cobrar, WhatsApp, menú (Cobrar, Renovar, Cancelar, WhatsApp, Editar, Eliminar).
- **Formulario**: cliente, vehículo, plan (radios), puesto, valor, fechas, observación.
- **Modal Cobrar**: monto (abono parcial), método de pago, vuelto.
- **Permisos**: todas admin+supervisor.

### 3.8 Ausencias (`/ausencias`)
- **Botones**: `Exportar`, `+ Nueva Ausencia`; por fila: WhatsApp, Editar, Finalizar, Eliminar.
- **Formulario**: cliente, vehículo, fechas, motivo, opción de pago (EXTENDER/DESCONTAR/CONGELAR/MANTENER/HISTORIAL).
- **Permisos**: crear/editar/finalizar admin+supervisor; **eliminar solo admin**.

### 3.9 Caja (`/caja`)
- **Componentes**: `CajaAbrirModal`, `CajaStatusWidget`, `CajaContext`.
- **Gate**: requiere contraseña (`POST /usuarios/verificar-password`) antes de operar.
- **Botones**: `Exportar`, `Abrir Caja` / `Cerrar Caja`; por movimiento: Editar, Anular.
- **Modales**: Cerrar Caja (arqueo de billetes/monedas, diferencia), Editar Caja, Detalle Caja, Editar Movimiento.
- **Permisos**: abrir/cerrar/movimientos admin+supervisor; editar caja / eliminar solo admin.

### 3.10 Facturas (`/facturas`)
- **Botones**: `Exportar`; por fila: Ver, PDF, Recibo, WhatsApp.
- **Permisos**: cualquier autenticado (con filtro de sucursal en backend).

### 3.11 Gastos (`/gastos`)
- **Botones**: `Exportar`, `Generar recurrentes`, `Nuevo Gasto`; por fila Editar, Eliminar.
- **Formulario**: concepto, categoría, valor, descripción, recurrente + periodicidad.
- **Permisos**: admin+supervisor.

### 3.12 Movimientos (`/movimientos`)
- **Botones**: `Exportar`. Solo lectura (auditoría).
- **Permisos**: admin+supervisor.

### 3.13 Reportes (`/reportes`)
- **Botones**: `PDF`, `Exportar` (facturas y gastos), presets Hoy/Semana/Mes/Personalizado, selector sucursal, `Consultar`.
- **Permisos**: admin+supervisor.

### 3.14 Configuración (`/configuracion`)
- **Pestañas**: Información, Logo, Fondo Login, Apariencia, Formato Regional, Métodos de Pago, Factura, Notificaciones, Mensajes WhatsApp, Operativa, Seguridad, Listas.
- **Botón**: `Guardar Cambios`.
- **Permisos**: admin+supervisor.

### 3.15 Tarifas (`/tarifas`)
- **Botones**: `Exportar`, `Nuevo Precio`; por tarjeta Editar, Eliminar.
- **Formulario**: tipo vehículo, modalidad (minuto/hora/diario/semanal/quincenal/mensual/otra), valor, cortesía, sección progresiva (primera hora, hora adicional, máxima diaria, minutos gratis), descripción.
- **Permisos**: **rutas backend solo admin**; ruta frontend sin role-guard ⚠.

### 3.16 Planes (`/planes`)
- **Botones**: `Exportar`, `Nuevo Plan`; por tarjeta Editar, Activar/Desactivar, Eliminar.
- **Formulario**: tipo vehículo, tipo de plan (Diario/Semanal/Quincenal/Mensual/Otro), nombre/duración auto, descripción, valor.
- **Permisos**: backend solo admin; frontend sin role-guard ⚠.

### 3.17 Usuarios (`/usuarios`, solo admin)
- **Botones**: `Exportar`, `Nuevo Usuario`; por fila Editar, Pass, Inactivar/Activar, Eliminar.
- **Formulario**: nombre, usuario, correo, sucursal, rol, contraseña.

### 3.18 Sucursales (`/sucursales`, solo admin)
- **Botones**: `Nueva Sucursal`; por tarjeta Editar. Formulario: nombre, dirección, teléfono.

### 3.19 Backup (`/backup`, solo admin)
- **Botones**: Generar Backup, Descargar JSON, Descartar, Restaurar Backup, Formatear (exige escribir `FORMATEAR`).

### 3.20 Ocupación (`/ocupacion`, sin menú)
- **Botones**: vista Todas/Zonas, Actualizar, filtros por estado. Refresco cada 5 s. Solo lectura.

### 3.21 Login / Recuperación
- **Login** (`/`): usuario/correo, contraseña, "Recordar usuario", `Entrar`.
- **ForgotPassword** (`/forgot-password`): stub que redirige a `/?modo=recuperar`.
- **ResetPassword** (`/reset-password`): token, nueva contraseña, confirmación, `Restablecer Contrasena`.

## 4. Hallazgos de navegación

- **Rutas sin role-guard en frontend** pese a menú restringido: `/tarifas`, `/planes`, `/ocupacion`. El **backend sí** exige admin en tarifas/planes (defensa real); el frontend carece de la capa visual.
- **Ocupación** accesible sin entrada de menú.
- **ForgotPassword** no contiene la UI de recuperación; delega a `Login` con `?modo=recuperar` (a verificar dónde se implementa el flujo completo).
- **Credenciales demo precargadas** en `Login.tsx` (`admin`/`Admin123`).

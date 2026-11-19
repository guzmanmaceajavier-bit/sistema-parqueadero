# Guía Completa del Proyecto Parqueadero

Documentación maestra: arquitectura, menús, formularios y conexiones.
Generada del código real (frontend `src/pages`, backend `src/modules` y simulación end-to-end).

---

# PARTE I — CÓMO FUNCIONA EL PROYECTO

## 1. Arquitectura general

```
┌─────────────────┐        HTTP/JSON        ┌──────────────────┐       SQL        ┌────────────────┐
│   FRONTEND      │  ────────────────────►   │     BACKEND      │  ─────────────►   │  PostgreSQL     │
│  React + Vite   │  ◄────────────────────   │ Express + Prisma │  ◄─────────────   │  (local/Neon)   │
│  :5174          │      cookies JWT         │ :3001            │                   │                 │
└─────────────────┘                          └──────────────────┘                   └────────────────┘
```

- **Frontend:** React 19 + Vite 8 + React Router (HashRouter) + Tailwind + Axios + lucide-react.
- **Backend:** Node 20 + Express 5 + Prisma 6.9 + TypeScript + Zod 3 (validación).
- **Base de datos:** PostgreSQL. Local = `parqueadero_db` / `parqueadero_test`; producción = Neon.
- **Tiempo real:** Socket.IO (eventos `ingreso:entrada`, `ingreso:salida`).
- **Autenticación:** login devuelve una cookie JWT; se envía en cada petición. Rol: `admin`, `supervisor`, `empleado`.

## 2. Flujo de una petición

1. El usuario interactúa en una página (`frontend/src/pages/X.tsx`).
2. El componente llama `api.get/post/put/delete` (Axios, `baseURL = "/api"`).
3. Vite hace proxy de `/api` → `http://localhost:3001` (`vite.config.js`).
4. El backend valida el body con un **schema Zod** (`backend/src/schemas/x.schema.ts`).
5. El **controlador** (`backend/src/modules/x/x.controller.ts`) ejecuta reglas de negocio y transacciones Prisma.
6. Prisma consulta PostgreSQL y devuelve JSON al frontend.
7. El frontend actualiza su estado y muestra Toast/Error.

## 3. Convenciones del código

- **Listados:** paginados (`page`, `limit`), búsqueda `q`, filtros por `estado`.
- **Formularios:** un objeto `form`/`formVacio` en `useState`; `handleChange` actualiza por `name`; un modal reutilizable `FormModal` con `titulo`, `subtitulo`, `footer`.
- **Búsquedas de entidades:** componentes `ClientSearch`, `VehicleSearch`, `SelectWithOther` (permite escribir valor personalizado).
- **Feedback:** `Toast` (éxito/error), `ConfirmDialog` (acciones destructivas), `ExportButton` (CSV), `Pagination`.
- **Roles en el sidebar:** Auditoría y Configuración = admin/supervisor; Usuarios, Sucursales, Backup = solo admin.

## 4. Estructura de carpetas

```
backend/src/
├─ modules/         # controladores + rutas por entidad (clientes, ingresos, caja...)
├─ schemas/         # validación Zod por entidad
├─ services/        # lógica de negocio (calculadorCobros, facturaCounter, scheduler, ticket...)
├─ helpers/         # movimientos, caja
├─ middlewares/     # auth, validate, error
├─ utils/           # dinero, saldos, pagination, sucursalAccess, formato
├─ config/          # prisma
└─ tests/           # unit + integration

frontend/src/
├─ pages/           # 21 pantallas (una por menú)
├─ components/      # Sidebar, ClientSearch, SelectWithOther, ui/ (FormModal, Select, etc.)
├─ context/         # AuthContext, ConfigContext, CajaContext, ListasContext, NotificacionesContext
├─ hooks/           # useAuth, useListas, useCaja...
└─ utils/           # formatters, api
```

---

# PARTE II — LOS 21 MENÚS

Para cada menú: **propósito**, **formulario y campos**, **endpoints**, **conexiones** y **acciones**.

---

## 1. Dashboard (`/dashboard`)
**Propósito:** pantalla de inicio con indicadores en vivo.

- **Formulario:** ninguno. Filtros: sucursal, periodo (Hoy / Esta Semana / Este Mes).
- **Endpoints:** `GET /sucursales`, `GET /puestos?all=true`, `GET /dashboard?filtro=&sucursalId=`.
- **KPIs:** Ingresos, Ocupación (%), Vehículos, Caja, Alertas — cada uno es clicable y lleva a su módulo.
- **Conexiones:** lleva a `/ingresos`, `/puestos`, `/vehiculos`, `/caja`, `/mensualidades`, `/ausencias`; accesos rápidos a Registrar entrada, Nuevo cliente, Abrir caja, Puestos; modal de WhatsApp.
- **Datos en vivo:** se actualiza por Socket.IO cuando entra/sale un vehículo.

## 2. Clientes (`/clientes`) — Registro y Gestión
**Propósito:** alta, edición y gestión de clientes **con vehículos y plan de pago en el mismo formulario**. (Documentado en detalle en la PARTE III.)

- **Formulario:** nombres, apellidos, documento, teléfono, correo, estado, dirección, observaciones; vehículos opcionales; **Plan de pago** (Ninguno / Suscripción / Reserva / Ingreso diario).
- **Endpoints:** `GET/POST /clientes`, `GET/PUT/DELETE /clientes/:id`, `GET /clientes/:id/bloqueos`, `POST /clientes/importar`, `POST /clientes/:id/recargar-saldo`, `POST /clientes/:id/ajustar-saldo`, `POST /vehiculos`, `POST /mensualidades`, `POST /reservas`, `POST /ingresos`.
- **Conexiones:** Perfil (`/clientes/:id/perfil`), carga planes/puestos/tarifas, WhatsApp.
- **Acciones:** Exportar, Importar, Nuevo Cliente, filtros, Perfil, Editar, Renovar plan, Recargar/Ajustar saldo, Eliminar, WhatsApp.

## 3. Perfil de cliente (`/clientes/:id/perfil`)
**Propósito:** vista 360° de un cliente.

- **Formulario:** ninguno (solo lectura + botón WhatsApp).
- **Endpoint:** `GET /clientes/:id/perfil`.
- **Muestra:** vehículos, historial de ingresos, pagos, mensualidades, dueños anteriores, reservas, ausencias y movimientos de saldo.
- **Conexiones:** enlazado desde Clientes; `Link` de vuelta a `/clientes`.

## 4. Vehículos (`/vehiculos`)
**Propósito:** inventario de vehículos con historial.

- **Formulario:** Placa*, Marca, Tipo, Clase, Modelo, Color, Propietario (ClientSearch), Tipo de cobro (NINGUNO/PLAN/TARIFA), Plan (si PLAN), Tarifa (si TARIFA), Observaciones, Bloqueado.
- **Endpoints:** `GET/POST /vehiculos`, `GET/PUT/DELETE /vehiculos/:id`, `GET /clientes`, `GET /planes`, `GET /tarifas`.
- **Conexiones:** ClientSearch (Clientes), planes y tarifas (Catálogos); el historial muestra propietarios, ingresos, mensualidades, ausencias y reservas.
- **Acciones:** Exportar, Nuevo Vehículo, Historial, Editar, Eliminar (admin).

## 5. Puestos (`/puestos`)
**Propósito:** inventario de celdas y su estado (LIBRE/RESERVADO/OCUPADO/MANTENIMIENTO).

- **Formularios:** crear (Código, Tipo multi-selección, Estado, Observación, Zona); masivo (Prefijo, Cantidad, Tipo, Zona); asignar (Cliente, Vehículo).
- **Endpoints:** `GET/POST /puestos`, `POST /puestos/masivos`, `GET/PUT/DELETE /puestos/:id`, `POST /ingresos`, `PUT /ingresos/liberar/:id`, `PUT /ausencias/finalizar/:id`.
- **Conexiones:** carga clientes, vehículos, ingresos, mensualidades y ausencias; al asignar valida plan activo y registra entrada (Ingresos).
- **Acciones:** Nuevo Puesto, Crear Masivos, filtros por tipo/zona/estado, Editar, Liberar, Mantenimiento, Finalizar ausencia, Asignar, Eliminar. Se refresca solo al enfocar la pestaña.

## 6. Ocupación (`/ocupacion` — widget en Dashboard)
**Propósito:** mapa visual de puestos en tiempo real.

- **Formulario:** ninguno. Filtros por estado y vista (Todas/Zonas).
- **Endpoint:** `GET /puestos?limit=500` (refresco cada 5 s).
- **Muestra:** placa del vehículo y tiempo transcurrido desde la entrada.

## 7. Entradas y Salidas (`/ingresos`)
**Propósito:** registrar entrada de vehículos y salida con cobro.

- **Formularios:**
  - Entrada: Cliente, Vehículo, Puesto (se autoasigna si hay plan vigente).
  - Salida: checkbox "Perdió el ticket", Método de pago, Recibi ($).
- **Endpoints:** `GET/POST /ingresos`, `GET/PUT/DELETE /ingresos/:id`, `POST /ingresos/simular-cobro`, `POST /ingresos/salida-con-cobro/:id`.
- **Conexiones:** si la caja está cerrada lleva a `/caja`; `window.open(/api/ingresos/:id/ticket)`; carga clientes, puestos, vehículos y mensualidades.
- **Acciones:** Registrar Entrada, Salida, Editar, Reingreso, Ticket, Eliminar, Ir a Caja.

## 8. Reservas (`/reservas`)
**Propósito:** apartar un puesto para fechas futuras.

- **Formulario:** Cliente, Vehículo (o crear uno rápido: Placa, Marca, Modelo, Color), Puesto, Fecha/hora inicio, Fecha/hora fin, Observaciones.
- **Endpoints:** `GET/POST /reservas`, `GET/PUT/DELETE /reservas/:id`, `PUT /reservas/:id/estado`, `PUT /reservas/cancelar/:id`, `POST /vehiculos`.
- **Conexiones:** preselecciona puesto si se llega desde Puestos (`location.state.puestoId`); ClientSearch/VehicleSearch; WhatsApp.
- **Acciones:** Nueva Reserva, Asignar puesto, Confirmar, Activar ingreso, Finalizar, Editar, Cancelar, Eliminar, WhatsApp.

## 9. Suscripciones (`/mensualidades`)
**Propósito:** planes aplicados a vehículos con fechas, puesto y cobro.

- **Formularios:** suscripción (Cliente, Vehículo, Plan, Puesto opcional, Valor, Fecha inicio, Fecha fin, Observación); cobro (Monto a pagar, Método de pago, Recibi).
- **Endpoints:** `GET/POST /mensualidades`, `GET/PUT/DELETE /mensualidades/:id`, `POST /mensualidades/cobrar/:id`, `POST /mensualidades/generar-facturas`, `PUT /mensualidades/cancelar/:id`.
- **Conexiones:** si caja cerrada → `/caja`; genera facturas (módulo Facturas); WhatsApp a vencidos; columna de ausencia y saldo pendiente.
- **Acciones:** Generar facturas, Nueva Suscripción, Cobrar, Cancelar, Editar, Eliminar, WhatsApp.

## 10. Ausencias (`/ausencias`)
**Propósito:** registrar salidas temporales de vehículos con plan.

- **Formulario:** Cliente, Vehículo, Fecha/hora salida, Fecha/hora regreso, Motivo, Acción sobre el pago (EXTENDER / DESCONTAR / CONGELAR / MANTENER / HISTORIAL).
- **Endpoints:** `GET/POST /ausencias`, `GET/PUT/DELETE /ausencias/:id`, `POST /ausencias/regresar/:id`.
- **Conexiones:** ClientSearch; desde Puestos se llama `/ausencias/finalizar/:id`; muestra puesto reservado y días compensados.
- **Acciones:** Nueva Ausencia, Editar, Registrar regreso, Eliminar, WhatsApp.

## 11. Caja (`/caja`) — Estado
**Propósito:** apertura, arqueo y cierre; una sola caja ABIERTA por sucursal.

- **Formularios:** Acceso (Contraseña); Cierre (Observación + arqueo por denominación); Editar caja (Monto apertura, Observación); Editar movimiento (Concepto, Monto, Método de pago).
- **Endpoints:** vía `CajaContext`: `GET /caja/actual`, `POST /usuarios/verificar-password`, `POST /caja/abrir`, `PUT /caja/cerrar/:id`; además `GET /caja`, `GET /caja/:id/movimientos`, `PUT /caja/:id`, `PUT /caja/movimiento/:id`, `DELETE /caja/movimiento/:id`.
- **Conexiones:** aviso "Venías de Ingresos/Salidas o Tarifas Fijas" (`?redirect=`); todos los cobros (Ingresos, Suscripciones, Gastos) exigen caja abierta.
- **Acciones:** Acceder, Abrir/Reabrir, Cerrar turno y guardar arqueo, Editar/Anular movimiento, Filtrar movimientos, Volver.

## 12. Facturas (`/facturas`)
**Propósito:** documentos de cobro; solo lectura + anulación.

- **Formulario:** ninguno (búsqueda; modal de detalle solo lectura).
- **Endpoints:** `GET /facturas`, `GET /facturas/:id`, `GET /facturas/pdf/:id`, `GET /facturas/whatsapp/:id`, `POST /facturas/:id/anular`, `GET /facturas/:id/recibo`.
- **Conexiones:** origen MENSUALIDAD → suscripción; INGRESO → entrada; usa configuración (nombre, NIT, IVA, pie) para el PDF.
- **Acciones:** Ver, PDF, Recibo, Anular (pide motivo), WhatsApp, Exportar.

## 13. Gastos (`/gastos`)
**Propósito:** egresos de caja, incluyendo recurrentes.

- **Formulario:** Concepto, Categoría, Valor ($), Descripción, Gasto recurrente (checkbox), Periodicidad; filtros de fecha.
- **Endpoints:** `GET/POST /gastos`, `GET/PUT/DELETE /gastos/:id`, `POST /gastos/generar-recurrentes`.
- **Conexiones:** si caja cerrada → `/caja`; genera movimiento EGRESO en Caja.
- **Acciones:** Nuevo Gasto, Generar recurrentes, Editar, Eliminar, Exportar.

## 14. Movimientos (`/movimientos`) — Auditoría
**Propósito:** bitácora de todas las acciones.

- **Formulario:** ninguno (búsqueda).
- **Endpoint:** `GET /movimientos`.
- **Muestra:** Módulo, Acción, Descripción, Usuario, Sucursal, fecha.
- **Acciones:** Exportar, buscar. Solo admin/supervisor.

## 15. Reportes (`/reportes`) — Auditoría
**Propósito:** agregados de facturación y gastos por periodo y sede.

- **Formulario:** presets (Hoy / Esta Semana / Este Mes / Personalizado), sucursal, Fecha inicio, Fecha fin.
- **Endpoints:** `GET /sucursales`, `GET /reportes?fechaInicio=&fechaFin=&sucursalId=`.
- **Conexiones:** usa `zonaHoraria` de Configuración (America/Bogota); exporta a PDF (jsPDF) y CSV.
- **Acciones:** PDF, exportar Facturas, exportar Gastos, Consultar. Solo admin/supervisor.

## 16. Tarifas / Precios por Tiempo (`/tarifas`)
**Propósito:** precios por tipo de vehículo y modalidad (hora/día/semana/quincena/mes).

- **Formulario:** Tipo de vehículo (checkbox + Otro), Modalidad (hora/diario/semanal/quincenal/mensual + Otra), Nombre (auto), Duración (auto), Valor, Minutos de cortesía, Precio primera hora, Precio hora adicional, Tarifa máxima diaria, Minutos gratis, Descripción.
- **Endpoints:** `GET/POST /tarifas`, `GET/PUT/DELETE /tarifas/:id`.
- **Conexiones:** consumida por Clientes, Vehículos, Ingresos y por el `calculadorCobros`.
- **Acciones:** Nuevo Precio, Editar, Eliminar, Exportar. Solo admin/supervisor.

## 17. Planes (`/planes`)
**Propósito:** planes comerciales (duración + valor + tipo de vehículo).

- **Formulario:** Tipo de vehículo (checkbox + Otro), Tipo de plan (diario/semanal/quincenal/mensual + Otro), Nombre y Duración (auto), Descripción, Valor ($).
- **Endpoints:** `GET/POST /planes`, `GET/PUT /planes/:id`, `PUT /planes/:id {activo}`, `DELETE /planes/:id`.
- **Conexiones:** usado por Clientes, Suscripciones y Vehículos.
- **Acciones:** Nuevo Plan, Editar, Activar/Desactivar, Eliminar, Exportar. Solo admin/supervisor.

## 18. Usuarios (`/usuarios`)
**Propósito:** cuentas y roles.

- **Formulario:** Nombre, Usuario, Correo, Sucursal asignada, Rol (empleado/supervisor/admin), Contraseña; modal "Pass" para cambiar contraseña.
- **Endpoints:** `GET/POST /usuarios`, `GET /sucursales`, `PUT /usuarios/:id`, `PUT /usuarios/:id {password}`, `PUT /usuarios/estado/:id`, `DELETE /usuarios/:id`.
- **Conexiones:** catálogo de Sucursales. Solo admin.
- **Acciones:** Nuevo Usuario, Editar, Pass, Activar/Inactivar, Eliminar, Exportar.

## 19. Sucursales (`/sucursales`)
**Propósito:** sedes del parqueadero.

- **Formulario:** Nombre*, Dirección, Teléfono.
- **Endpoints:** `GET/POST /sucursales`, `PUT /sucursales/:id` (sin DELETE).
- **Conexiones:** consumido por Usuarios, Reportes y Dashboard (filtro por sede). Solo admin.
- **Acciones:** Nueva Sucursal, Editar, Guardar.

## 20. Configuración (`/configuracion`) — General
**Propósito:** parámetros globales del sistema (12 pestañas).

- **Pestañas:** Información (nombre, NIT, teléfono, dirección, ciudad, correo, WhatsApp); Logo; Fondo Login; Apariencia (colores, modo oscuro, fuente); Formato Regional (fecha, hora, moneda, zona horaria, idioma); Métodos de Pago; Factura (pie); Notificaciones; Mensajes WhatsApp (7 plantillas con variables `{{cliente}}`, `{{placa}}`…); Operativa (horarios, paginación, IVA, minutos gracia); Seguridad (intentos máximos); Listas.
- **Endpoints:** `GET/POST /configuracion`, `POST /configuracion/upload-logo`, `DELETE /configuracion/logo`, `POST /configuracion/upload-fondo`, `DELETE /configuracion/fondo`.
- **Conexiones:** la config global alimenta Facturas, Reportes, Ingresos, Caja, Dashboard y Reservas.
- **Acciones:** Guardar Cambios, subir/eliminar imágenes, restaurar plantillas. Solo admin/supervisor.

## 21. Backup (`/backup`)
**Propósito:** exportar/importar datos y formatear.

- **Formularios:** archivo `.json` para restaurar; texto de confirmación "FORMATEAR".
- **Endpoints:** `GET /backup`, `POST /backup/restaurar`, `POST /configuracion/formatear`.
- **Conexiones:** cubre usuarios, clientes, vehículos, puestos, tarifas, planes y configuración; tras formatear recarga `/`.
- **Acciones:** Generar Backup, Descargar JSON, Restaurar, Formatear. Solo admin. **Seguridad:** el backup excluye contraseñas hasheadas.

---

# PARTE III — FORMULARIO DE REGISTRO DE CLIENTE (detalle)

El menú **Clientes → Nuevo Cliente** es el más completo: registra cliente, vehículos y plan de pago en un solo flujo.

## Datos del cliente
| Campo | Tipo | Observación |
|---|---|---|
| Nombres | texto | requerido |
| Apellidos | texto | requerido |
| Documento | texto | requerido, único en el sistema |
| Teléfono | texto | opcional; se usa para WhatsApp |
| Correo electrónico | texto | opcional |
| Estado | Select | Activo / Ausente / Vencido / Suspendido / Moroso |
| Dirección | texto | opcional |
| Observaciones | textarea | opcional |
| Bloquear cliente | checkbox | solo al editar; impide registrar ingresos |

## Vehículos (opcional)
Botón **"Agregar vehículo"** → uno o más bloques con:
| Campo | Tipo | Observación |
|---|---|---|
| Placa | texto | se convierte a mayúsculas |
| Tipo | SelectWithOther | opción **"Otro tipo"** para escribir |
| Clase | SelectWithOther | opción "Otra clase" |
| Marca | SelectWithOther | opción "Otra marca" |
| Color | texto | opcional |
| Observaciones | textarea | opcional |

Se puede guardar el cliente sin vehículo.

## Plan de pago (selector único, excluyente)
| Opción | Campos que aparecen | Qué crea al guardar |
|---|---|---|
| **Ninguno** | — | Solo cliente y vehículos |
| **Suscripción** | Plan, Puesto (opcional), Observación | Una mensualidad; requiere ≥1 vehículo con placa |
| **Reserva** | Inicio, Fin, Puesto (opcional), Observaciones | Una reserva |
| **Ingreso diario** | Tarifa, Puesto | Una entrada activa |

**Regla importante:** suscripción y reserva no pueden solaparse en el tiempo para el mismo vehículo. El backend rechaza el cruce con `409 "El vehículo tiene una mensualidad que se cruza con ese periodo"`.

## Cómo se guarda (backend)
1. `POST /clientes` → crea el cliente.
2. `POST /vehiculos` por cada vehículo con placa (ligado al `clienteId`).
3. Según el plan de pago: `POST /mensualidades`, `POST /reservas` o `POST /ingresos`.
4. En edición: actualiza cliente, sincroniza vehículos (crea/actualiza/elimina) y actualiza el plan correspondiente.

---

# PARTE IV — MAPA DE CONEXIONES ENTRE MENÚS

```
                    ┌──────────────┐
                    │  CONFIGURACIÓN│ (colores, zona horaria, IVA, listas, métodos de pago)
                    └──────┬───────┘
                           │ alimenta a todos
┌─────────┐   perfil   ┌───▼───────┐   vehículos   ┌──────────┐
│ Perfil  │◄───────────│ Clientes  │──────────────►│ Vehículos│
└─────────┘            └───┬───────┘               └────┬─────┘
                           │ plan de pago               │ tarifa/plan
              ┌────────────┼────────────┐               │
              ▼            ▼            ▼               │
      ┌───────────┐ ┌─────────┐ ┌──────────┐            │
      │Suscripciones│ │Reservas │ │ Ingresos │◄───────────┘
      └─────┬─────┘ └────┬────┘ └────┬─────┘
            │            │           │ entrada/salida
            │ facturas   │ puesto    ▼
            │            │      ┌─────────┐   caja   ┌──────┐
            └────────────┼─────►│ Facturas│◄────────►│ Caja │◄─── Gastos
                         │      └────┬────┘          └───┬──┘
                         ▼           │                   │
                   ┌──────────┐      │ reportes          │ movimientos
                   │ Ausencias│      ▼                   ▼
                   └────┬─────┘  ┌─────────┐      ┌────────────┐
                        │        │ Reportes│      │ Movimientos│
                        ▼        └─────────┘      └────────────┘
                   ┌─────────┐
                   │ Puestos │◄── asignación de puesto desde Reservas/Ingresos
                   └────┬────┘
                        ▼
                   ┌──────────┐
                   │ Ocupación│ (vista en Dashboard, tiempo real)
                   └──────────┘

Catálogos base: Tarifas y Planes → usados por Clientes, Vehículos, Suscripciones, Ingresos.
Sucursales → Usuarios, Reportes, Dashboard.
```

## Reglas de integridad que conectan menús
1. **Todo cobro pasa por Caja:** Ingresos, Suscripciones y Gastos exigen caja abierta; si está cerrada redirigen a `/caja`.
2. **El puesto se recalcula solo:** al entrar/salir, crear/cancelar plan o reserva, su estado se deriva de las tablas reales.
3. **El plan respeta su puesto:** entrada, salida y reingreso usan el puesto del plan; no se puede forzar otro.
4. **Salida con plan no factura; salida sin plan sí** (factura + movimiento de caja).
5. **Anular factura revierte** caja y saldo, sin borrar historial (contrapartida + auditoría).
6. **Fechas en UTC:** las comparaciones SQL usan `AT TIME ZONE 'UTC'` para evitar falsos conflictos por zona horaria.
7. **Sin renovación gratuita:** la renovación solo ocurre al registrar el pago (con factura).

---

# PARTE V — FLUJOS DE NEGOCIO PRINCIPALES

## Flujo A — Cliente con plan
1. Registrar cliente con vehículo y **Suscripción** (Clientes).
2. Se crea mensualidad; el puesto pasa a RESERVADO.
3. El vehículo entra (Ingresos o Puestos): sistema autoasigna el puesto del plan → OCUPADO, `tipoIngreso="plan_mensual"`.
4. Al salir: **sin cobro**, sin factura; el puesto vuelve a RESERVADO.
5. Al reingresar: recupera el mismo puesto.

## Flujo B — Cliente ocasional
1. Registrar entrada (Ingresos) eligiendo puesto.
2. Simular cobro → calcula tarifa por tiempo (`calculadorCobros`).
3. Registrar salida con cobro → crea factura + movimiento de caja INGRESO; descuenta saldo si tiene; puesto → LIBRE.
4. Si el plan venció durante la estancia, solo cobra el excedente posterior al vencimiento.

## Flujo C — Suscripción
1. Crear suscripción (Suscripciones o Clientes).
2. Cobrar mensualidad: abono parcial deja saldo; pago total renueva el periodo (empieza al día siguiente del fin anterior).
3. "Generar facturas" crea facturas pendientes de deuda (sin mover caja).

## Flujo D — Reserva
1. Crear reserva con fechas futuras → PENDIENTE.
2. Al entrar el vehículo, se vincula al ingreso → ACTIVA.
3. Al salir → FINALIZADA.

## Flujo E — Caja
1. Abrir caja con contraseña (una sola por sucursal).
2. Movimientos de ingresos/gastos se ligan a la caja.
3. Cerrar con arqueo: compara esperado vs contado, muestra diferencia.

---

# PARTE VI — VERIFICACIÓN Y ANOMALÍAS CONOCIDAS

- **Simulación end-to-end:** `backend/prisma/seed/simular-flujos.mjs` ejecuta los flujos reales contra PostgreSQL y verifica clientes, vehículos, puestos, plan, entrada, cobro, salida, anulación, caja y reservas.
- **Tests:** 115 pasan; 2 de integración requieren entorno de test (`E2eAdmin123`, backend en 3001).
- **Bugs corregidos en esta sesión:** `valor` opcional en mensualidad; `count()` en transacciones; Prisma client regenerado; fechas con `AT TIME ZONE 'UTC'`; estados de cliente coherentes; selector de plan de pago visible.
- **Nota:** los avisos de React Router ("Future Flag Warning") son informativos, no errores.

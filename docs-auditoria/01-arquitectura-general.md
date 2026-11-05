# 01 — Arquitectura general

> Documento de auditoría. Toda afirmación está respaldada por archivos del repositorio.
> No se modificó ningún archivo del proyecto.

## 1. Identidad del proyecto

Sistema de administración de parqueaderos ("ParkAdmin"). Monorepo con backend y frontend separados.

```
parqueadero/
├── backend/        # API REST + lógica de negocio
├── frontend/       # SPA React
├── Dockerfile      # imagen backend (raíz)
├── docker-compose.yml
├── iniciar-parqueadero.bat / instalar.bat   # despliegue local Windows
├── backup-diario.ps1 / restaurar-backup.ps1 # respaldo Postgres local
└── README.md
```

## 2. Stack tecnológico

| Capa | Tecnología | Evidencia |
|---|---|---|
| Lenguaje backend | TypeScript (ESM, ESNext) | `backend/tsconfig.json`, `backend/package.json` (`"type":"module"`) |
| Runtime backend | Node.js 20 | `Dockerfile` (`FROM node:20-alpine`), logs de ejecución |
| Framework backend | Express 5 | `backend/package.json` `"express": "^5.2.1"` |
| ORM | Prisma 6.9.0 | `backend/package.json`, `backend/prisma/schema.prisma` |
| Base de datos | PostgreSQL 16 | `docker-compose.yml` (`postgres:16-alpine`), `schema.prisma` `provider = "postgresql"` |
| Validación | Zod 3 | `backend/package.json` `"zod": "^3.24.0"` |
| Autenticación | JWT (jsonwebtoken) en cookie httpOnly | `usuarios.controller.ts` (res.cookie), `auth.middleware.ts` |
| Hashing | bcrypt (12 rondas) | `usuarios.controller.ts`, `usuarios.service.ts` |
| Tiempo real | Socket.IO | `backend/src/services/socket.ts`, `frontend` `socket.io-client` |
| PDF | PDFKit | `backend/src/services/ticket.service.ts` |
| Correo | Nodemailer | `backend/src/services/mail.service.ts` |
| Push | web-push (VAPID) | `backend/src/modules/notificaciones` |
| Cron | node-cron | `backend/src/services/scheduler.ts` |
| Docs API | swagger-jsdoc + swagger-ui-express | `backend/src/config/swagger.ts` |
| Frontend | React 19 + Vite 8 | `frontend/package.json` |
| Router frontend | React Router 6 (**HashRouter**) | `frontend/src/routes/AppRouter.tsx` línea 49 |
| Estilos | Tailwind CSS 3 | `frontend/package.json`, `frontend/tailwind.config.js` |
| HTTP cliente | Axios | `frontend/src/services/api.ts` |
| Export frontend | xlsx, jspdf, jspdf-autotable | `frontend/package.json`, `frontend/src/utils/exportData.ts` |

## 3. Arquitectura del backend (patrón modular)

Cada módulo en `backend/src/modules/<modulo>/` contiene típicamente:
- `<modulo>.routes.ts` — define endpoints + middlewares.
- `<modulo>.controller.ts` — lógica de negocio y acceso a datos (vía Prisma).
- ocasionalmente `<modulo>.service.ts` / `.helpers.ts` / `.utils.ts`.

Capa transversal:
- `backend/src/middlewares/` — auth, roles, validate (Zod), validateId, sanitize, error.
- `backend/src/config/prisma.ts` — instancia única de PrismaClient.
- `backend/src/services/` — calculadorCobros, facturaCounter, scheduler, socket, ticket, mail.
- `backend/src/helpers/` — caja, movimientos.
- `backend/src/utils/` — fechas, saldos, puestos, sucursalAccess, pagination.
- `backend/src/schemas/` — esquemas Zod por entidad.

Punto de entrada `backend/src/app.ts`:
1. Carga `.env` con dotenv.
2. Valida `JWT_SECRET` (aborta en producción si < 32 chars o débil) — líneas 41-50.
3. Configura Helmet, CORS por whitelist, rate-limit global, cookie-parser, JSON 25 MB, sanitizeBody, morgan.
4. Sirve `/uploads` con control de traversal.
5. Monta 21 routers bajo `/api/...` (líneas 109-130).
6. Swagger solo fuera de producción (`/api-docs`).
7. `crearUsuarioAdmin()` (crea admin inicial si no existe).
8. `initSocket(server)` + `iniciarScheduler()` (cron cada 10 min).
9. `server.listen(PORT)` (default 3000; en `.env` local 3001).

**No hay capa de "servicios" independiente obligatoria**: la mayoría de controladores accede a Prisma directamente; solo ingresos, usuarios, clientes, puestos, vehiculos y configuracion tienen `.service.ts` (algunos con funciones no usadas, ver §12 de hallazgos).

## 4. Arquitectura del frontend

- SPA con enrutado en hash (`HashRouter`), por lo que las URLs son `dominio/#/ruta`.
- `App.tsx` anida providers: `ErrorBoundary → ConfigProvider → ListasProvider → ThemeApplier → NotificacionProvider → AppRouter`. `AuthProvider` y `CajaProvider` se montan en `main.tsx`.
- Lazy loading por página (`React.lazy` + `Suspense`).
- Tema dinámico: `App.tsx` inyecta CSS variables (`theme-dynamic`) a partir de la configuración (colores, modo oscuro, tamaño de fuente).
- Estado global por Context API: auth, caja, config, listas, notificaciones.
- Comunicación con backend vía `frontend/src/services/api.ts` (Axios con `withCredentials`, refresh automático de token, guard de logout).

## 5. Comunicación entre componentes

```
Navegador (React SPA)
   │  HTTPS + cookies httpOnly
   ▼
Express API (/api/*)  ──middlewares──►  Controllers ──► Prisma ──► PostgreSQL
   │                                                   │
   │ Socket.IO (eventos en vivo)                        ├─ PDFKit (tickets)
   ▼                                                   ├─ Nodemailer (correo)
Frontend recibe eventos                                ├─ web-push (notificaciones)
(caja:*, ingreso:*, reserva:*)                         └─ node-cron (scheduler)
```

- **REST**: el frontend llama `/api/<modulo>` (proxy `/api` → backend en desarrollo vía `frontend/vite.config.js`; en producción `VITE_API_URL`).
- **JWT**: al hacer login el backend setea cookie `token` (httpOnly, 4 h). El frontend **no** almacena el token en JS; usa `withCredentials`. En 401, `api.ts` intenta `POST /usuarios/refresh-token` una vez.
- **Socket.IO**: `NotificacionContext` y `CajaContext` escuchan eventos (`ingreso:entrada`, `ingreso:salida`, `caja:abierta`, `caja:cerrada`, `reserva:*`) para refrescar datos.

## 6. Autenticación y autorización

- **Autenticación**: `POST /api/usuarios/login` valida usuario/correo + bcrypt, bloquea la cuenta 15 min tras 5 intentos fallidos, registra en tabla `Acceso`, firma JWT con `{id, usuario, rol, tokenVersion}`. `verificarToken` (auth.middleware.ts) recarga rol/sucursal y valida `tokenVersion` **contra la BD en cada request** (logout/invalidación son inmediatos).
- **Autorización**:
  - `verificarRol(...roles)` → 401 sin identidad, 403 con rol no permitido.
  - Aislamiento multi-sucursal: `resolverSucursalPermitida` restringe a usuarios con `sucursalId`; admin ve todo.
- **Roles** (solo tres; no existe rol "cliente"): `admin`, `supervisor`, `empleado`. Default `empleado`.

## 7. API REST y servicios externos

- 21 routers montados en `/api/...`: usuarios, configuracion, clientes, vehiculos, puestos, ingresos, tarifas, dashboard, caja, mensualidades, gastos, reservas, ausencias, alertas, planes, movimientos, facturas, backup, notificaciones, sucursales, reportes.
- Documentación Swagger en `/api-docs` (solo dev).
- Servicios externos: SMTP (recuperación de contraseña), WhatsApp mediante enlaces `wa.me` generados en el backend (no API oficial), Web Push (VAPID), y PostgreSQL.

## 8. Sistema de despliegue

| Modo | Config |
|---|---|
| Docker | `Dockerfile` (raíz) construye backend; `docker-compose.yml` levanta db + backend + frontend. |
| Local Windows | `instalar.bat` (instala, compila, programa backup y autoarranque), `iniciar-parqueadero.bat`. |
| Nube (referenciado) | Render (backend Docker + Static Site) + Neon (PostgreSQL). El `start` del backend ejecuta `prisma migrate deploy && tsx src/app.ts`. |

- Migraciones Prisma en `backend/prisma/migrations` (20). Estrategia documentada en `backend/prisma/MIGRATIONS.md`.
- `.gitignore` ignora `.env*`, `node_modules`, `dist`, `*.sql` (salvo migraciones), `uploads/`.

## 9. Variables de configuración (sin revelar secretos)

Extraídas de `.env.example` / `backend/.env.example` / `docker-compose.yml` / `app.ts`:

| Variable | Uso | Archivo |
|---|---|---|
| `DATABASE_URL` | Conexión PostgreSQL (obligatoria) | `schema.prisma`, `app.ts` |
| `SHADOW_DATABASE_URL` | Solo para `prisma migrate dev` | `schema.prisma` |
| `JWT_SECRET` | Firma de tokens (mínimo 32 chars) | `app.ts`, `auth.middleware.ts` |
| `ADMIN_PASSWORD` | Clave del admin inicial (mín 8) | `usuarios.service.ts` |
| `PORT` | Puerto HTTP (default 3000; local 3001) | `app.ts` |
| `NODE_ENV` | production/development | `app.ts` |
| `CORS_ORIGINS` | Lista de orígenes permitidos | `app.ts` |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM/FROM_NAME` | Correo | `mail.service.ts` |
| `FRONTEND_URL` | Enlaces en correos | `mail.service.ts` |
| `VAPID_PUBLIC_KEY/PRIVATE_KEY` | Web Push | `notificaciones` |
| `DB_PASSWORD` | Password Postgres en compose | `docker-compose.yml` |
| `VITE_API_URL` | URL del backend en frontend | `frontend/src/services/api.ts` |
| `API_URL` | Proxy Vite en dev | `frontend/vite.config.js` |

## 10. Observaciones arquitectónicas (para el revisor)

- No hay capa de repositorio/servicio uniforme: lógica de negocio vive en controladores grandes (p. ej. `ingresos.controller.ts` 820 líneas, `mensualidades.controller.ts` 682).
- La concurrencia se resuelve con `pg_advisory_xact_lock` con IDs fijos (78124018-78124022) y `SELECT ... FOR UPDATE` — consistente pero centralizado en convención, no en abstracción.
- El proyecto **no usa** el directorio `backend/src/tests` como suite aislada; varias pruebas SQL/HTTP dependen de una base local viva (ver documento 11).

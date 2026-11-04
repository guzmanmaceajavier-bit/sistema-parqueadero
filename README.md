# ParkAdmin

Sistema web para administrar un parqueadero: entradas y salidas con cobro
automático, planes de suscripción, reservas de puesto, caja y facturación PDF.
Funciona en una sola PC (instalación local) o desplegado en la nube (Render + Neon).

## Qué hace

- Registro de entradas y salidas; el cobro por tiempo se calcula solo (tarifas o plan de suscripción).
- Puestos con estado (libre / ocupado / reservado / mantenimiento / ausencia).
- Planes de suscripción con puesto fijo y renovación automática.
- Reservas de puestos con fecha y validación de solapamientos.
- Caja: apertura, movimientos del día y cierre con arqueo.
- Facturas en PDF y envío por WhatsApp.
- Dashboard con ocupación e ingresos del día.
- Usuarios con roles: `admin`, `supervisor`, `empleado`.

## Stack

| Parte | Tecnologías |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, React Router, Axios |
| Backend | Node.js 20, Express 5, Prisma ORM, Socket.IO, Zod |
| Base de datos | PostgreSQL 16 |
| Auth | JWT en cookies httpOnly, roles por usuario |
| Extras | PDFKit (facturas), Docker Compose (opcional) |

## Cómo correrlo (desarrollo)

Necesitas Node 20 y PostgreSQL 16 corriendo en el equipo.

**1. Backend (http://localhost:3001)**

```bash
cd backend
npm install
# backend/.env mínimo:
# DATABASE_URL="postgresql://postgres:TU_CLAVE@localhost:5432/parqueadero_db"
# SHADOW_DATABASE_URL="postgresql://postgres:TU_CLAVE@localhost:5432/parqueadero_shadow"   (solo para `prisma migrate dev`)
# JWT_SECRET=una-clave-larga (openssl rand -hex 32)
# ADMIN_PASSWORD=clave-inicial-del-admin
npm run migrate:deploy     # aplica las migraciones (nunca `db push`)
npm run dev
```

**2. Frontend (http://localhost:5173)**

```bash
cd frontend
npm install
npm run dev
```

Entra con `admin` y la clave de `ADMIN_PASSWORD`. Si la base estaba vacía, el
backend crea ese admin solo en el primer arranque.

## Instalación en la PC del parqueadero (una sola vez)

```bash
instalar.bat       # verifica Node y PostgreSQL, instala, compila y programa backup diario
iniciar-parqueadero.bat   # abre el sistema (o se auto-arranca con Windows)
```

## Despliegue en producción (Render + Neon)

1. Ramas: despliega desde `main`.
2. Backend = Web Service Docker (`Dockerfile` de la raíz), con estas variables:
   - `DATABASE_URL` → cadena de Neon **directa** (no `-pooler`).
   - `JWT_SECRET` → aleatoria y larga (`openssl rand -hex 32`).
   - `NODE_ENV=production`, `CORS_ORIGINS` → URL del frontend.
   - `ADMIN_PASSWORD`.
   El arranque ejecuta `prisma migrate deploy` automáticamente.
3. Frontend = Static Site: `cd frontend && npm install && npm run build`,
   publicar `frontend/dist`, definir `VITE_API_URL` = URL del backend y
   redirección `/* -> /index.html` (Rewrite).

Detalles de la estrategia de base de datos en `backend/prisma/MIGRATIONS.md`.

## Estructura

```
backend/src/modules   # cada módulo (ingresos, caja, tarifas, ...)
backend/src/schemas   # validaciones Zod
backend/prisma        # schema.prisma y migraciones
frontend/src/pages    # pantallas
frontend/src/services # cliente Axios (auth refresh)
```

## Autor

guzmanmaceajavier@gmail.com

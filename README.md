# ParkAdmin

Sistema web para administrar parqueaderos: entradas y salidas con cobro
automático, planes mensuales, reservas, caja y facturación en PDF.
Lo hice pensando en el computador del parqueadero, corriendo todo en local.

**Demo:** https://sistema-parqueadero-mu.vercel.app

Por seguridad, las credenciales de acceso no se publican en este repositorio. En instalaciones nuevas, define `ADMIN_PASSWORD` en el archivo de entorno del backend y utiliza esa clave para el primer acceso.

## Qué hace

- Registro de entradas y salidas, calcula el cobro por tiempo solo.
- Planes mensuales con puesto fijo y control de días.
- Reservas de puestos con fecha.
- Caja: apertura, movimientos del día y cierre con arqueo.
- Facturas en PDF.
- Dashboard con ocupación e ingresos del día.
- Usuarios con roles (admin, supervisor, empleado).

## Con qué está hecho

| Parte | Tecnologías |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, React Router, Axios |
| Backend | Node.js 20, Express 5, Prisma ORM, Socket.IO, Zod |
| Base de datos | PostgreSQL 16 |
| Auth | JWT en cookies httpOnly, roles por usuario |
| Extras | PDFKit (facturas), Docker Compose (opcional) |

## Cómo correrlo

Necesitas Node 20 y PostgreSQL 16 corriendo en el equipo.

```bash
# 1. Backend (http://localhost:3001)
cd backend
npm install
# backend/.env mínimo:
# DATABASE_URL="postgresql://postgres:TU_CLAVE@localhost:5432/parqueadero_db"
# SHADOW_DATABASE_URL="postgresql://postgres:TU_CLAVE@localhost:5432/parqueadero_shadow"  (solo para `migrate dev`)
# JWT_SECRET=un-secreto-largo-generado-con-crypto
# ADMIN_PASSWORD=clave-inicial-del-admin
# CORS_ORIGINS=https://tu-dominio.com
npm run migrate:deploy   # aplica las migraciones (NO usar `db push`)
npm run dev
```

> La base de datos se versiona con **migraciones** de Prisma, no con `db push`.
> Para desarrollo local, cuando cambies `schema.prisma`, usa `npx prisma migrate dev`.
> Nunca uses `db push` contra producción.

```bash
# 2. Frontend (http://localhost:5173), en otra consola
cd frontend
npm install
npm run dev
```

Entra con `admin` y la clave que pusiste en `ADMIN_PASSWORD`. Si la base
estaba vacía, el backend crea ese admin solo en el primer arranque.

En desarrollo no hace falta `frontend/.env`: Vite ya manda `/api` al backend. En producción configura `CORS_ORIGINS` con los dominios exactos desde los que se servirá el frontend.

## Estructura

```
backend/src/modules   # cada cosa (ingresos, caja, tarifas…) vive en su módulo
backend/src/schemas   # validaciones Zod
backend/prisma        # esquema de la base de datos
frontend/src/pages    # pantallas
frontend/src/services # cliente Axios con refresh de token
```

## Capturas

Login
<img width="1195" height="594" alt="image" src="https://github.com/user-attachments/assets/f0f58ade-5fa8-40d1-ba70-70e1455a2f91" />

Dashboard
<img width="1351" height="620" alt="image" src="https://github.com/user-attachments/assets/9501d680-9747-46ca-8b78-d1f00508f1b0" />

Caja
<img width="1173" height="607" alt="image" src="https://github.com/user-attachments/assets/fbeb5ef0-a340-4ef0-98ab-146c4391327a" />

## Autor

guzmanmaceajavier@gmail.com

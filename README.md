# ParkAdmin

Sistema web para administrar parqueaderos: entradas y salidas con cobro
automático, planes mensuales, reservas, caja y facturación en PDF.
Lo hice pensando en el computador del parqueadero, corriendo todo en local.

**Demo:** https://sistema-parqueadero-mu.vercel.app

```
usuario: admin
clave:   Admin123
```

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
# JWT_SECRET=un-secreto-largo-generado-con-crypto
# ADMIN_PASSWORD=clave-inicial-del-admin
npx prisma db push
npm run dev
```

```bash
# 2. Frontend (http://localhost:5173), en otra consola
cd frontend
npm install
npm run dev
```

Entra con `admin` y la clave que pusiste en `ADMIN_PASSWORD`. Si la base
estaba vacía, el backend crea ese admin solo en el primer arranque.

En desarrollo no hace falta `frontend/.env`: Vite ya manda `/api` al backend.

## Estructura

```
backend/src/modules   # cada cosa (ingresos, caja, tarifas…) vive en su módulo
backend/src/schemas   # validaciones Zod
backend/prisma        # esquema de la base de datos
frontend/src/pages    # pantallas
frontend/src/services # cliente Axios con refresh de token
```

## Lo que más me costó (y cómo salió)

- **El login me devolvía 401 en cascada al cerrar sesión.** Resultó ser
  una condición de carrera: el frontend pedía el refresh con un token que
  el backend ya había invalidado. Lo arreglé cancelando las peticiones en
  vuelo al cerrar sesión y limpiando el estado de auth antes de volver a entrar.
- **429 por todos lados en desarrollo.** El rate-limit global (60/min)
  no aguanta un SPA con StrictMode que dispara 10 llamadas a la vez.
  Quedó amplio en desarrollo (600/min) y estricto en producción.
- **Migraciones vs esquema desfasados.** La base local se había creado con
  `db push` y le faltaban columnas a las migraciones; en una base nueva
  fallaba el seed. Desde entonces verifico contra base limpia.
- **Las variables de Vercel no aplican sin redeploy.** Cambié el backend
  de URL y la demo seguía hablando con el viejo hasta reconstruir.

## Estado

Funciona en local y hay demo en línea.

- [x] Parqueadero operable (caja, planes, facturas, dashboard)
- [ ] Correo real para recuperar contraseña
- [ ] Facturación electrónica (fase 2)

## Autor

Javier Guzmán — guzmanmaceajavier@gmail.com

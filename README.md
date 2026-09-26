# ParkAdmin

Sistema integral de gestión de parqueaderos con facturación automática, planes mensuales, reservas, control de caja y dashboard en tiempo real.

**Production:** [https://sistema-parqueadero-st8t.vercel.app](https://sistema-parqueadero-st8t.vercel.app)

## Arquitectura

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend   │────▶│     Backend      │────▶│    PostgreSQL    │
│  React/Vite  │     │  Express/Prisma  │     │ Neon (nube) o    │
│ Vercel/local │     │  Render/local    │     │ local (dev)      │
└─────────────┘     └──────────────────┘     └─────────────────┘
     SPA +              REST API +                Persistent
     TailwindCSS         WebSocket               Storage
```

> **Nota Oct-2026:** la BD gratuita de Render se suspende el 2-oct.
> En nube se usa **Neon** (`DATABASE_URL` manual en Render, ver `render.yaml`).
> En local se usa **PostgreSQL 16** en `localhost:5432`.

## Stack Tecnológico

| Capa | Tecnología | Despliegue |
|------|-----------|------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, React Router v6, Socket.IO Client | Vercel |
| **Backend** | Node.js 20, Express 5, TypeScript, Prisma ORM, JWT, Socket.IO, PDFKit | Render (Docker) |
| **Base de datos** | PostgreSQL 16 | Neon (nube) / local `localhost:5432` |
| **Auth** | JWT + httpOnly cookies | — |
| **Seguridad** | Helmet, rate limiting, input sanitization, parameterized queries | — |

## Funcionalidades

- **Entrada/Salida** — Registro con cálculo automático de cobro por minuto/hora/día/semana/mes
- **Planes** — Suscripciones con puesto fijo, tracking de días usados vs contratados
- **Caja** — Apertura/cierre con arqueo, ingresos y egresos del día
- **Dashboard** — Métricas en tiempo real: ocupación, ingresos, gráficos, top vehículos
- **Reservas** — Asignación de puestos con fechas, vinculación automática al ingreso
- **Ausencias** — Programación con descuento automático de días del plan
- **Facturación** — Generación de facturas con PDF
- **Usuarios** — Roles admin/supervisor/empleado con control de acceso
- **Notificaciones** — WebSocket para actualizaciones en tiempo real
- **Reportes** — Exportación de datos y reportes financieros
- **Backup** — Sistema de respaldo y restauración de datos

## Seguridad

- JWT con httpOnly cookies (sameSite: none, secure en producción)
- Rate limiting global (60 req/min) y por endpoint (login: 5/min)
- Helmet con cross-origin resource policy
- CORS restringido a orígenes permitidos
- Sanitización de inputs contra XSS
- Queries parametrizadas (prevención SQL injection)
- Container Docker ejecutándose como usuario no-root
- Bloqueo automático tras 5 intentos fallidos
- Swagger restringido a desarrollo

## Inicio rápido (local)

Requiere Node 20 + PostgreSQL 16 corriendo en el PC.

```bash
# Terminal 1 — Backend (http://localhost:3001)
cd backend
npm install
npm run dev   # espera "Servidor corriendo en puerto 3000|3001"

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Entrar con usuario `admin` y la clave de `ADMIN_PASSWORD` del `backend/.env`.
En dev no necesitas `frontend/.env`: Vite ya redirige `/api` al backend.
El rate-limit es amplio en desarrollo (600/min) y estricto en producción (60/min).

### Respaldo de Render (antes del 2-oct)

```powershell
.\respaldo-render.ps1 -DatabaseUrl "postgresql://..."
.\restaurar-local.ps1
```

## Variables de entorno

### Backend (.env)

```env
DATABASE_URL=postgresql://...
JWT_SECRET=tu-secreto-seguro-min-32-chars
ADMIN_PASSWORD=TuPasswordSeguro123!
NODE_ENV=development
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3000
```

## Despliegue

### Docker (producción)

```bash
docker build -t parqueadero .
docker run -p 3000:3000 --env-file .env parqueadero
```

### Render + Vercel + Neon

- **Backend:** Docker en Render (plan free, se duerme sin uso: primer request ~30-50s)
- **Base de datos:** Neon gratis — crear proyecto en `neon.tech` y pegar la
  pooled connection string en Render → Environment → `DATABASE_URL`, luego Redeploy.
  (`render.yaml` ya no crea DB en Render; `DATABASE_URL` es `sync: false`.)
- **Esquema en Neon:** `npx prisma migrate deploy` con la URL directa de Neon.
- **Frontend:** Vercel con SPA rewrite (sin cambios, apunta al backend de Render)
- **Variables de entorno:** Configurar en el dashboard de cada plataforma

## Estructura del proyecto

```
├── backend/
│   ├── src/
│   │   ├── modules/        # Módulos de dominio (auth, caja, facturas, etc.)
│   │   ├── middlewares/     # Auth, validación, sanitización, errores
│   │   ├── schemas/        # Validación con Zod
│   │   ├── services/       # Socket.IO, mail, scheduler, PDF
│   │   ├── helpers/        # Utilidades compartidas
│   │   └── config/         # Prisma client, Swagger
│   ├── prisma/
│   │   └── schema.prisma   # Schema de base de datos
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/          # Componentes de página
│   │   ├── components/     # Componentes reutilizables
│   │   ├── context/        # React Context (Auth, Config, Socket)
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API client (Axios)
│   │   └── routes/         # Rutas protegidas/guest
│   └── vite.config.js
├── render.yaml             # Deploy config (Render, sin DB: usa Neon)
├── vercel.json             # SPA rewrite (Vercel)
├── docker-compose.yml      # Alternativa Docker local (db + backend + frontend)
├── .env.example            # Vars para docker-compose (DB_PASSWORD, JWT_SECRET…)
├── frontend/.env.example   # Vars opcionales del frontend
├── respaldo-render.ps1     # Backup de Render (pg_dump, antes del 2-oct)
└── restaurar-local.ps1     # Restore al Postgres local
```

## Licencia

Uso interno.

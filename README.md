# ParkAdmin

Sistema integral de gestión de parqueaderos con facturación automática, planes mensuales, reservas, control de caja y dashboard en tiempo real.

**Production:** [https://sistema-parqueadero-st8t.vercel.app](https://sistema-parqueadero-st8t.vercel.app)

## Arquitectura

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend   │────▶│     Backend      │────▶│    PostgreSQL    │
│  React/Vite  │     │  Express/Prisma  │     │  Render Managed  │
│   Vercel     │     │  Docker/Render   │     │                  │
└─────────────┘     └──────────────────┘     └─────────────────┘
     SPA +              REST API +                Persistent
     TailwindCSS         WebSocket               Storage
```

## Stack Tecnológico

| Capa | Tecnología | Despliegue |
|------|-----------|------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, React Router v6, Socket.IO Client | Vercel |
| **Backend** | Node.js 20, Express 5, TypeScript, Prisma ORM, JWT, Socket.IO, PDFKit | Render (Docker) |
| **Base de datos** | PostgreSQL 16 | Render Managed Database |
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

## Inicio rápido

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run dev

# Frontend
cd frontend
npm install
npm run dev
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

### Render + Vercel

- **Backend:** Docker en Render con PostgreSQL managed
- **Frontend:** Vercel con SPA rewrite
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
├── render.yaml             # Deploy config (Render)
├── vercel.json             # SPA rewrite (Vercel)
└── docker-compose.yml      # Desarrollo local
```

## Licencia

Uso interno.

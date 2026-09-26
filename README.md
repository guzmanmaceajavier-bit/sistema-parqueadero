# ParkAdmin

Sistema integral de gestión de parqueaderos con facturación automática, planes mensuales, reservas, control de caja y dashboard en tiempo real.

Uso local: frontend + backend + PostgreSQL corriendo en el mismo PC, sin nube.

## Arquitectura

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend   │────▶│     Backend      │────▶│    PostgreSQL    │
│  React/Vite  │     │  Express/Prisma  │     │   16 en el PC    │
│ localhost:   │     │  localhost:      │     │  localhost:      │
│ 5173         │     │ 3001             │     │ 5432             │
└─────────────┘     └──────────────────┘     └─────────────────┘
     SPA +              REST API +              Datos locales
     TailwindCSS         WebSocket              persistentes
```

## Stack Tecnológico

| Capa | Tecnología | Local |
|------|-----------|-------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, React Router v6, Socket.IO Client | `http://localhost:5173` |
| **Backend** | Node.js 20, Express 5, TypeScript, Prisma ORM, JWT, Socket.IO, PDFKit | `http://localhost:3001` |
| **Base de datos** | PostgreSQL 16 | `localhost:5432/parqueadero_db` |
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
- Rate limiting global (600 req/min en desarrollo, 60 en producción) y login limitado
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
npm run dev   # espera "Servidor corriendo en puerto 3001"

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Entrar con usuario `admin` y la clave de `ADMIN_PASSWORD` del `backend/.env`.
En dev no necesitas `frontend/.env`: Vite ya redirige `/api` al backend.
Los datos quedan guardados en el PostgreSQL local, persisten entre reinicios.

## Variables de entorno

### Backend (.env)

```env
DATABASE_URL=postgresql://...
JWT_SECRET=tu-secreto-seguro-min-32-chars
ADMIN_PASSWORD=TuPasswordSeguro123!
NODE_ENV=development
```

### Frontend (.env, opcional)

En desarrollo no se necesita: Vite redirige `/api` al backend.
Solo definiría `VITE_API_URL` si el frontend se sirve sin ese proxy:

```env
# VITE_API_URL=http://localhost:3001
```

## Entrega a un cliente (PC del parqueadero)

1. Instalar Node 20 + PostgreSQL 16 en el PC.
2. Ejecutar `instalar.bat` como Administrador (instala dependencias, compila el
   frontend, crea las tablas con `prisma db push`, genera `JWT_SECRET`,
   programa el backup diario 23:00 y deja el arranque automático con Windows).
3. Abrir con `iniciar-parqueadero.bat` (también arranca solo al prender el PC).
4. Entrar con `admin` + `ADMIN_PASSWORD` de `backend/.env`. El backend crea el
   admin solo en el primer arranque si no existe.

### Backups

- Automático diario en `C:\Parqueadero\backups` (se conservan 30 días).
- Restaurar: `powershell -ExecutionPolicy Bypass -File restaurar-backup.ps1`
  (usa el más reciente o `-Archivo <ruta>`; pide confirmación con `SI`).
- Pendiente por cliente: configurar SMTP real en `backend/.env` para que
  funcione "olvidé mi contraseña" por correo; sin eso queda desactivado.

## Despliegue local con Docker (opcional)

Alternativa a los dos `npm run dev`: levanta db + backend + frontend juntos.

```bash
Copy-Item .env.example .env   # y ajusta DB_PASSWORD / JWT_SECRET
docker compose up -d --build  # app en http://localhost (puerto 80)
```

Los datos persisten en el volumen `pgdata` y los uploads en `backend/uploads`.

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
├── docker-compose.yml      # Docker local (db + backend + frontend)
├── .env.example            # Vars para docker-compose (DB_PASSWORD, JWT_SECRET…)
├── frontend/.env.example   # Vars opcionales del frontend
├── instalar.bat            # Instalador único en PC del cliente
├── iniciar-parqueadero.bat # Arranque diario con doble clic
├── backup-diario.ps1       # Backup completo pg_dump (tarea 23:00)
└── restaurar-backup.ps1    # Restore con confirmación
```

## Licencia

Uso interno.

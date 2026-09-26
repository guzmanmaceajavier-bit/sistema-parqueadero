# ParkAdmin

Sistema de gestión de parqueaderos: entradas y salidas con cobro automático,
planes mensuales, reservas, caja con arqueo, facturación en PDF y dashboard
en tiempo real.

Funciona 100% en local: frontend + backend + PostgreSQL en el mismo PC.

## Requisitos

- Node.js 20
- PostgreSQL 16 corriendo en el equipo

## Cómo ejecutarlo

Dos terminales:

```bash
# Terminal 1 — backend (http://localhost:3001)
cd backend
npm install   # solo la primera vez
npm run dev
```

```bash
# Terminal 2 — frontend (http://localhost:5173)
cd frontend
npm install   # solo la primera vez
npm run dev
```

Abre `http://localhost:5173` y entra con el usuario `admin` y la clave
definida en `ADMIN_PASSWORD` dentro de `backend/.env`.

Notas:

- No hace falta crear `frontend/.env`: en desarrollo Vite ya redirige
  `/api` al backend.
- En el primer arranque con base de datos vacía, el backend crea el
  usuario admin automáticamente.
- Los datos se guardan en el PostgreSQL local (`parqueadero_db`) y
  persisten entre reinicios.

## Respaldo manual (recomendado de vez en cuando)

```powershell
powershell -ExecutionPolicy Bypass -File backup-diario.ps1
```

Guarda copia completa en `C:\Parqueadero\backups` (se conservan 30 días).
Para restaurar: `restaurar-backup.ps1` (pide confirmación).

## Estructura del proyecto

```
├── backend/                # API Express + Prisma + Socket.IO
│   ├── src/
│   │   ├── modules/        # Dominios: auth, caja, facturas, ingresos…
│   │   ├── middlewares/    # Auth, validación, sanitización, errores
│   │   ├── schemas/        # Validación con Zod
│   │   ├── services/       # Socket.IO, mail, scheduler, PDF
│   │   ├── helpers/        # Utilidades compartidas
│   │   └── config/         # Cliente Prisma, Swagger
│   └── prisma/
│       └── schema.prisma   # Esquema de la base de datos
├── frontend/               # React 19 + Vite + Tailwind
│   └── src/
│       ├── pages/          # Pantallas
│       ├── components/     # Componentes reutilizables
│       ├── context/        # Auth, Config, Caja, Socket…
│       ├── services/       # Cliente Axios
│       └── routes/         # Rutas protegidas
├── docker-compose.yml      # Alternativa: todo con Docker
├── .env.example            # Variables para docker-compose
└── frontend/.env.example   # Variables opcionales del frontend
```

## Licencia

Uso interno.

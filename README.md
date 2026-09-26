# ParkAdmin

Sistema para llevar un parqueadero: entradas y salidas con cobro automático,
mensualidades, reservas, caja, facturas en PDF y un dashboard para ver cómo
va el día. Corre todo en el mismo PC, no depende de internet.

## Qué se necesita

- Node 20
- PostgreSQL 16 instalado y corriendo

La base se llama `parqueadero_db`. Si no existe, el backend la usa igual
después de hacer el `db push` (abajo está el comando).

## Cómo lo prendo

Hacen falta dos consolas abiertas al tiempo.

Consola 1, el backend:

```bash
cd backend
npm install   # la primera vez nada más
npm run dev
```

Cuando veas `Servidor corriendo en puerto 3001` ya quedó. La primera vez
se demora un poco compilando, es normal.

Consola 2, el frontend:

```bash
cd frontend
npm install   # la primera vez nada más
npm run dev
```

Abre `http://localhost:5173` y entra con:

- usuario: `admin`
- clave: la que esté en `ADMIN_PASSWORD` dentro de `backend/.env`

Si la base está vacía, el backend crea el admin solo en ese primer arranque.

Ojo con dos cosas que me pasaron: si el puerto 5173 sale ocupado es porque
quedó otro proceso de antes abierto (cierra las consolas viejas), y en el
frontend no hay que crear ningún `.env`, Vite ya manda todo lo de `/api`
al backend.

## Por si algo se daña

De vez en cuando saco copia de la base con:

```powershell
powershell -ExecutionPolicy Bypass -File backup-diario.ps1
```

Queda en `C:\Parqueadero\backups` y guarda las de los últimos 30 días. Para
devolver una copia está `restaurar-backup.ps1`, que pregunta antes de
sobrescribir.

## Qué hay en cada carpeta

- `backend/` — la API (Express + Prisma + Socket.IO). El esquema de la base
  está en `backend/prisma/schema.prisma`.
- `frontend/` — la app en React con Vite y Tailwind.
- `docker-compose.yml` — por si algún día lo quiero levantar con Docker
  en vez de los dos `npm run dev`.
- Los `.env.example` son la guía de qué variables lleva cada lado. Los
  `.env` de verdad no se suben al repo.

## Licencia

Uso interno.

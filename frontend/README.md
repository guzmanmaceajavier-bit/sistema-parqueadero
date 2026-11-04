# ParkAdmin — Frontend

Aplicación React (Vite + TypeScript) del sistema de parqueaderos.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173 — proxy /api -> http://localhost:3001
```

No requiere `.env` en desarrollo: el proxy de Vite ya apunta al backend local.

## Build de producción

```bash
npm run build    # genera dist/
npm run preview  # sirve el build localmente
```

En producción, define `VITE_API_URL` con la URL pública del backend (sin barra final)
por ejemplo: `https://tu-backend.onrender.com`.

Ver `README.md` en la raíz para el despliegue completo.

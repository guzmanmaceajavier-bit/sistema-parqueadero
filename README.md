# ParkAdmin

Sistema integral de gestión de parqueaderos. Control de entrada/salida de vehículos, facturación automática, planes mensuales, reservas, caja diaria, y notificaciones vía WhatsApp.

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, React Router v6, Chart.js |
| **Backend** | Node.js 20, Express, TypeScript, Prisma ORM, JWT, Socket.IO, PDFKit |
| **Base de datos** | PostgreSQL 16 |
| **Infraestructura** | Docker Compose, Caddy (proxy reverso + TLS) |

## Inicio rápido

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
node seed.js
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Funcionalidades

- **Entrada/Salida**: registro con simulación de cobro, tarifas por minuto/hora/diario/semanal/mensual
- **Planes**: suscripciones con puesto fijo, tracking de días usados vs contratados
- **Caja**: apertura/cierre con arqueo, ingresos y egresos del día
- **WhatsApp**: mensajes masivos a clientes desde el dashboard
- **Reservas**: asignación de puestos con fechas, vinculación automática al ingreso
- **Ausencias**: programación de ausencias con descuento automático de días del plan
- **Dashboard**: métricas en tiempo real, gráficos de ingresos, ocupación
- **Facturación**: generación de facturas con PDF y envío por WhatsApp
- **Usuarios**: roles admin/supervisor/empleado con control de acceso

## Licencia

Uso interno.

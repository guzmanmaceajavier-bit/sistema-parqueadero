import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import http from "http";
import { swaggerSpec, swaggerUi } from "./config/swagger.js";
import usuariosRoutes from "./modules/usuarios/usuarios.routes.js";
import configuracionRoutes from "./modules/configuracion/configuracion.routes.js";
import clientesRoutes from "./modules/clientes/clientes.routes.js";
import vehiculosRoutes from "./modules/vehiculos/vehiculos.routes.js";
import puestosRoutes from "./modules/puestos/puestos.routes.js";
import ingresosRoutes from "./modules/ingresos/ingresos.routes.js";
import tarifasRoutes from "./modules/tarifas/tarifas.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import cajaRoutes from "./modules/caja/caja.routes.js";
import mensualidadesRoutes from "./modules/mensualidades/mensualidades.routes.js";
import gastosRoutes from "./modules/gastos/gastos.routes.js";
import reservasRoutes from "./modules/reservas/reservas.routes.js";
import ausenciasRoutes from "./modules/ausencias/ausencias.routes.js";
import alertasRoutes from "./modules/alertas/alertas.routes.js";
import planesRoutes from "./modules/planes/planes.routes.js";
import movimientosRoutes from "./modules/movimientos/movimientos.routes.js";
import facturasRoutes from "./modules/facturas/facturas.routes.js";
import backupRoutes from "./modules/backup/backup.routes.js";
import notificacionesRoutes from "./modules/notificaciones/notificaciones.routes.js";
import sucursalesRoutes from "./modules/sucursales/sucursales.routes.js";
import reportesRoutes from "./modules/reportes/reportes.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { sanitizeBody } from "./middlewares/sanitize.middleware.js";
import { initSocket } from "./services/socket.js";
import { iniciarScheduler } from "./services/scheduler.js";

const NODE_ENV = process.env.NODE_ENV || "development";

// Validar JWT_SECRET al iniciar
const JWT_SECRET = process.env.JWT_SECRET || "";
const isWeak = JWT_SECRET.length < 32 || ["parqueadero_super_secret", "secret", "jwt_secret"].includes(JWT_SECRET);
if (isWeak) {
  if (NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET es débil. Genera uno fuerte con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    process.exit(1);
  }
  console.warn("⚠ JWT_SECRET débil. En producción usa uno de 64+ caracteres hex.");
}

const app = express();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Demasiadas peticiones, intente de nuevo en 1 minuto" },
});

app.use(helmet());
const CORS_ORIGINS = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : ["http://localhost:5173", "http://localhost:3000"];
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(limiter);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(sanitizeBody);
app.use(morgan("dev"));
const UPLOADS_DIR = path.resolve("uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use("/uploads", (req, res, next) => {
  const filename = path.basename(req.path);
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!filePath.startsWith(UPLOADS_DIR)) {
    return res.status(403).json({ ok: false, message: "Acceso denegado" });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, message: "Archivo no encontrado" });
  }
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.sendFile(filePath);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/configuracion", configuracionRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/vehiculos", vehiculosRoutes);
app.use("/api/puestos", puestosRoutes);
app.use("/api/ingresos", ingresosRoutes);
app.use("/api/tarifas", tarifasRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/caja", cajaRoutes);
app.use("/api/mensualidades", mensualidadesRoutes);
app.use("/api/gastos", gastosRoutes);
app.use("/api/reservas", reservasRoutes);
app.use("/api/ausencias", ausenciasRoutes);
app.use("/api/alertas", alertasRoutes);

app.use("/api/planes", planesRoutes);
app.use("/api/movimientos", movimientosRoutes);
app.use("/api/facturas", facturasRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/notificaciones", notificacionesRoutes);
app.use("/api/sucursales", sucursalesRoutes);
app.use("/api/reportes", reportesRoutes);
app.get("/", (req, res) => {
  res.json({
    message: "Backend funcionando correctamente",
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
initSocket(server);
iniciarScheduler();
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
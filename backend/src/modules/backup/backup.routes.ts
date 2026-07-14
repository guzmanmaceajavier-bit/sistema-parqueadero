import express from "express";
import rateLimit from "express-rate-limit";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { verificarRol } from "../../middlewares/roles.middleware.js";
import { generarBackup, restaurarBackup } from "./backup.controller.js";

const router = express.Router();

const restoreLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Demasiados intentos de restauracion. Maximo 3 por hora." },
});

/**
 * @swagger
 * /backup:
 *   get:
 *     summary: Generar backup de la base de datos
 *     tags: [Backup]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Backup generado correctamente
 *       403:
 *         description: No autorizado
 */
router.get("/", verificarToken, verificarRol("admin"), generarBackup);

/**
 * @swagger
 * /backup/restaurar:
 *   post:
 *     summary: Restaurar base de datos desde un archivo SQL
 *     tags: [Backup]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Base de datos restaurada
 *       400:
 *         description: Error al restaurar
 *       429:
 *         description: Demasiados intentos (max 3 por hora)
 */
router.post("/restaurar", verificarToken, verificarRol("admin"), restoreLimiter, restaurarBackup);

export default router;

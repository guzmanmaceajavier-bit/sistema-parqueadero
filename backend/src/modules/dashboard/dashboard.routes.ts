import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { obtenerDashboard } from "./dashboard.controller.js";

const router = express.Router();

/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: Obtener datos del dashboard
 *     tags: [Dashboard]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Datos del dashboard
 */
router.get("/", verificarToken, obtenerDashboard);

export default router;

import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { obtenerAlertas } from "./alertas.controller.js";

const router = express.Router();

/**
 * @swagger
 * /alertas:
 *   get:
 *     summary: Obtener alertas del sistema
 *     tags: [Alertas]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de alertas
 */
router.get("/", verificarToken, obtenerAlertas);

export default router;

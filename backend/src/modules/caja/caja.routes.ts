import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { verificarRol } from "../../middlewares/roles.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { validateIdParam } from "../../middlewares/validateId.middleware.js";
import { abrirCajaSchema, cerrarCajaSchema } from "../../schemas/caja.schema.js";
import { abrirCaja, obtenerCajaActiva as obtenerCajaActual, cerrarCaja, obtenerCajas, obtenerCaja, obtenerMovimientosCaja, actualizarMovimientoCaja, eliminarMovimientoCaja, actualizarCaja, eliminarCaja } from "./caja.controller.js";
import rateLimit from "express-rate-limit";

const cajaLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, message: { ok: false, message: "Demasiadas operaciones de caja. Intente de nuevo en 1 minuto." } });

const router = express.Router();

/**
 * @swagger
 * /caja/abrir:
 *   post:
 *     summary: Abrir caja
 *     tags: [Caja]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [apertura]
 *             properties:
 *               apertura: { type: number }
 *     responses:
 *       201:
 *         description: Caja abierta
 *       400:
 *         description: Ya hay una caja abierta
 */
router.post("/abrir", verificarToken, cajaLimiter, validate(abrirCajaSchema), abrirCaja);

/**
 * @swagger
 * /caja/actual:
 *   get:
 *     summary: Obtener caja actual abierta
 *     tags: [Caja]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Datos de la caja actual
 *       400:
 *         description: No hay caja abierta
 */
router.get("/actual", verificarToken, obtenerCajaActual);

/**
 * @swagger
 * /caja/cerrar/{id}:
 *   put:
 *     summary: Cerrar caja
 *     tags: [Caja]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cierre: { type: number }
 *     responses:
 *       200:
 *         description: Caja cerrada
 *       400:
 *         description: Error al cerrar caja
 */
router.put("/cerrar/:id", verificarToken, verificarRol("admin", "supervisor"), validateIdParam, validate(cerrarCajaSchema), cerrarCaja);

/**
 * @swagger
 * /caja/historial:
 *   get:
 *     summary: Obtener historial de cierres de caja
 *     tags: [Caja]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de cierres
 */
router.get("/historial", verificarToken, verificarRol("admin", "supervisor"), obtenerCajas);

/**
 * @swagger
 * /caja/{id}/movimientos:
 *   get:
 *     summary: Obtener movimientos de una caja
 *     tags: [Caja]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de movimientos
 */
router.get("/", verificarToken, verificarRol("admin", "supervisor"), obtenerCajas);
router.get("/:id", verificarToken, validateIdParam, obtenerCaja);
router.get("/:id/movimientos", verificarToken, validateIdParam, obtenerMovimientosCaja);
router.put("/:id", verificarToken, validateIdParam, verificarRol("admin"), actualizarCaja);
router.put("/movimiento/:id", verificarToken, validateIdParam, actualizarMovimientoCaja);
router.delete("/:id", verificarToken, validateIdParam, verificarRol("admin"), eliminarCaja);
router.delete("/movimiento/:id", verificarToken, validateIdParam, eliminarMovimientoCaja);

export default router;

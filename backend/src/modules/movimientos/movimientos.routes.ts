import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { verificarRol } from "../../middlewares/roles.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { validateIdParam } from "../../middlewares/validateId.middleware.js";
import { crearMovimientoSchema, actualizarMovimientoSchema } from "../../schemas/movimiento.schema.js";
import { obtenerMovimientos, crearMovimiento, actualizarMovimiento, eliminarMovimiento } from "./movimientos.controller.js";

const router = express.Router();

/**
 * @swagger
 * /movimientos:
 *   get:
 *     summary: Obtener lista de movimientos
 *     tags: [Movimientos]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de movimientos
 */
router.get("/", verificarToken, obtenerMovimientos);

/**
 * @swagger
 * /movimientos:
 *   post:
 *     summary: Crear un nuevo movimiento
 *     tags: [Movimientos]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [concepto, monto, tipo]
 *             properties:
 *               concepto: { type: string }
 *               monto: { type: number }
 *               tipo: { type: string, enum: [INGRESO, EGRESO] }
 *               descripcion: { type: string }
 *     responses:
 *       201:
 *         description: Movimiento creado
 *       400:
 *         description: Error de validacion
 */
router.post("/", verificarToken, validate(crearMovimientoSchema), crearMovimiento);
router.put("/:id", verificarToken, validateIdParam, validate(actualizarMovimientoSchema), actualizarMovimiento);

/**
 * @swagger
 * /movimientos/{id}:
 *   delete:
 *     summary: Eliminar un movimiento
 *     tags: [Movimientos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Movimiento eliminado
 *       404:
 *         description: Movimiento no encontrado
 */
router.delete("/:id", verificarToken, validateIdParam, eliminarMovimiento);

export default router;

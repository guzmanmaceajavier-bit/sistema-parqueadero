import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { validateIdParam } from "../../middlewares/validateId.middleware.js";
import { crearAusenciaSchema, actualizarAusenciaSchema } from "../../schemas/ausencia.schema.js";
import {
  crearAusencia, obtenerAusencias, obtenerAusencia, actualizarAusencia, finalizarAusencia, eliminarAusencia,
} from "./ausencias.controller.js";

const router = express.Router();

/**
 * @swagger
 * /ausencias:
 *   post:
 *     summary: Registrar una ausencia
 *     tags: [Ausencias]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clienteId: { type: integer }
 *               fechaInicio: { type: string, format: date }
 *               fechaFin: { type: string, format: date }
 *               motivo: { type: string }
 *     responses:
 *       201:
 *         description: Ausencia registrada
 *       400:
 *         description: Error de validacion
 */
router.post("/", verificarToken, validate(crearAusenciaSchema), crearAusencia);

/**
 * @swagger
 * /ausencias:
 *   get:
 *     summary: Obtener lista de ausencias
 *     tags: [Ausencias]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de ausencias
 */
router.get("/", verificarToken, obtenerAusencias);

/**
 * @swagger
 * /ausencias/{id}:
 *   get:
 *     summary: Obtener una ausencia por ID
 *     tags: [Ausencias]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos de la ausencia
 *       404:
 *         description: Ausencia no encontrada
 */
router.get("/:id", verificarToken, validateIdParam, obtenerAusencia);
router.put("/:id", verificarToken, validateIdParam, validate(actualizarAusenciaSchema), actualizarAusencia);

/**
 * @swagger
 * /ausencias/finalizar/{id}:
 *   put:
 *     summary: Finalizar una ausencia
 *     tags: [Ausencias]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Ausencia finalizada
 */
router.put("/finalizar/:id", verificarToken, validateIdParam, finalizarAusencia);

/**
 * @swagger
 * /ausencias/{id}:
 *   delete:
 *     summary: Eliminar una ausencia
 *     tags: [Ausencias]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Ausencia eliminada
 *       404:
 *         description: Ausencia no encontrada
 */
router.delete("/:id", verificarToken, validateIdParam, eliminarAusencia);

export default router;

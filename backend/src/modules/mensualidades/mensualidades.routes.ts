import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { verificarRol } from "../../middlewares/roles.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { validateIdParam } from "../../middlewares/validateId.middleware.js";
import { crearMensualidadSchema, actualizarMensualidadSchema } from "../../schemas/mensualidad.schema.js";
import { crearMensualidad, obtenerMensualidades, obtenerMensualidad, obtenerVencidas, renovarMensualidad, actualizarMensualidad, cancelarMensualidad, eliminarMensualidad, cobrarMensualidad, generarFacturasPendientes } from "./mensualidades.controller.js";

const router = express.Router();

/**
 * @swagger
 * /mensualidades:
 *   post:
 *     summary: Crear una nueva mensualidad
 *     tags: [Mensualidades]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clienteId, vehiculoId, fechaInicio, fechaFin, valor]
 *             properties:
 *               clienteId: { type: integer }
 *               vehiculoId: { type: integer }
 *               fechaInicio: { type: string, format: date }
 *               fechaFin: { type: string, format: date }
 *               valor: { type: number }
 *     responses:
 *       201:
 *         description: Mensualidad creada
 *       400:
 *         description: Error de validacion
 */
router.post("/", verificarToken, validate(crearMensualidadSchema), crearMensualidad);

/**
 * @swagger
 * /mensualidades:
 *   get:
 *     summary: Obtener lista de mensualidades
 *     tags: [Mensualidades]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de mensualidades
 */
router.get("/", verificarToken, obtenerMensualidades);

/**
 * @swagger
 * /mensualidades/vencidas:
 *   get:
 *     summary: Obtener mensualidades vencidas
 *     tags: [Mensualidades]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de mensualidades vencidas
 */
router.get("/vencidas", verificarToken, obtenerVencidas);

/**
 * @swagger
 * /mensualidades/{id}:
 *   get:
 *     summary: Obtener una mensualidad por ID
 *     tags: [Mensualidades]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos de la mensualidad
 *       404:
 *         description: Mensualidad no encontrada
 */
router.get("/:id", verificarToken, validateIdParam, obtenerMensualidad);

/**
 * @swagger
 * /mensualidades/renovar/{id}:
 *   put:
 *     summary: Renovar una mensualidad
 *     tags: [Mensualidades]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Mensualidad renovada
 */
router.put("/renovar/:id", verificarToken, validateIdParam, renovarMensualidad);

/**
 * @swagger
 * /mensualidades/cancelar/{id}:
 *   put:
 *     summary: Cancelar una mensualidad
 *     tags: [Mensualidades]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Mensualidad cancelada
 */
router.put("/cancelar/:id", verificarToken, validateIdParam, cancelarMensualidad);
router.put("/:id", verificarToken, validateIdParam, validate(actualizarMensualidadSchema), actualizarMensualidad);

/**
 * @swagger
 * /mensualidades/{id}:
 *   delete:
 *     summary: Eliminar una mensualidad
 *     tags: [Mensualidades]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Mensualidad eliminada
 */
router.delete("/:id", verificarToken, validateIdParam, eliminarMensualidad);

/**
 * @swagger
 * /mensualidades/cobrar/{id}:
 *   post:
 *     summary: Cobrar una mensualidad
 *     tags: [Mensualidades]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Mensualidad cobrada
 */
router.post("/cobrar/:id", verificarToken, validateIdParam, cobrarMensualidad);
router.post("/generar-facturas", verificarToken, generarFacturasPendientes);

export default router;

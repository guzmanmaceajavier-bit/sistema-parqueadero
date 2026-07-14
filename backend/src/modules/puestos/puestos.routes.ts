import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { verificarRol } from "../../middlewares/roles.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { validateIdParam } from "../../middlewares/validateId.middleware.js";
import { crearPuestoSchema, crearPuestosMasivosSchema, actualizarPuestoSchema } from "../../schemas/puesto.schema.js";
import { crearPuesto, crearPuestosMasivos, obtenerPuestos, obtenerPuesto, actualizarPuesto, eliminarPuesto, togglePuesto } from "./puestos.controller.js";

const router = express.Router();

/**
 * @swagger
 * /puestos:
 *   post:
 *     summary: Crear un nuevo puesto de estacionamiento
 *     tags: [Puestos]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [codigo, tipo]
 *             properties:
 *               codigo: { type: string }
 *               tipo: { type: string, enum: [carro, moto, bicicleta] }
 *     responses:
 *       201:
 *         description: Puesto creado
 *       400:
 *         description: Error de validacion
 */
router.post("/", verificarToken, verificarRol("admin", "supervisor"), validate(crearPuestoSchema), crearPuesto);
router.post("/masivos", verificarToken, verificarRol("admin", "supervisor"), validate(crearPuestosMasivosSchema), crearPuestosMasivos);

/**
 * @swagger
 * /puestos:
 *   get:
 *     summary: Obtener lista de puestos
 *     tags: [Puestos]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de puestos
 */
router.get("/", verificarToken, obtenerPuestos);

/**
 * @swagger
 * /puestos/{id}:
 *   get:
 *     summary: Obtener un puesto por ID
 *     tags: [Puestos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos del puesto
 *       404:
 *         description: Puesto no encontrado
 */
router.get("/:id", verificarToken, validateIdParam, obtenerPuesto);
router.put("/:id", verificarToken, verificarRol("admin", "supervisor"), validateIdParam, validate(actualizarPuestoSchema), actualizarPuesto);

/**
 * @swagger
 * /puestos/{id}:
 *   delete:
 *     summary: Eliminar un puesto
 *     tags: [Puestos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Puesto eliminado
 *       404:
 *         description: Puesto no encontrado
 */
router.delete("/:id", verificarToken, verificarRol("admin"), validateIdParam, eliminarPuesto);

/**
 * @swagger
 * /puestos/toggle/{id}:
 *   put:
 *     summary: Cambiar estado (activo/inactivo) de un puesto
 *     tags: [Puestos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estado cambiado
 */
router.put("/toggle/:id", verificarToken, verificarRol("admin", "supervisor"), validateIdParam, togglePuesto);

export default router;

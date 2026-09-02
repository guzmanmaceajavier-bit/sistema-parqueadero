import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { verificarRol } from "../../middlewares/roles.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { validateIdParam } from "../../middlewares/validateId.middleware.js";
import { crearTarifaSchema, actualizarTarifaSchema } from "../../schemas/tarifa.schema.js";
import { crearTarifa, obtenerTarifas, obtenerTarifa, actualizarTarifa, eliminarTarifa } from "./tarifas.controller.js";

const router = express.Router();

/**
 * @swagger
 * /tarifas:
 *   post:
 *     summary: Crear una nueva tarifa
 *     tags: [Tarifas]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, tipoVehiculo, precioPorHora]
 *             properties:
 *               nombre: { type: string }
 *               tipoVehiculo: { type: string, enum: [carro, moto, bicicleta] }
 *               precioPorHora: { type: number }
 *     responses:
 *       201:
 *         description: Tarifa creada
 *       400:
 *         description: Error de validacion
 */
router.post("/", verificarToken, verificarRol("admin"), validate(crearTarifaSchema), crearTarifa);

/**
 * @swagger
 * /tarifas:
 *   get:
 *     summary: Obtener lista de tarifas
 *     tags: [Tarifas]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de tarifas
 */
router.get("/", verificarToken, obtenerTarifas);

/**
 * @swagger
 * /tarifas/{id}:
 *   get:
 *     summary: Obtener una tarifa por ID
 *     tags: [Tarifas]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos de la tarifa
 *       404:
 *         description: Tarifa no encontrada
 */
router.get("/:id", verificarToken, validateIdParam, obtenerTarifa);
router.put("/:id", verificarToken, validateIdParam, verificarRol("admin"), validate(actualizarTarifaSchema), actualizarTarifa);

/**
 * @swagger
 * /tarifas/{id}:
 *   delete:
 *     summary: Eliminar una tarifa
 *     tags: [Tarifas]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Tarifa eliminada
 *       404:
 *         description: Tarifa no encontrada
 */
router.delete("/:id", verificarToken, validateIdParam, verificarRol("admin"), eliminarTarifa);

export default router;

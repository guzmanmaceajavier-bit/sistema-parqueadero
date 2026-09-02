import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { crearVehiculo, obtenerVehiculos, obtenerVehiculo, actualizarVehiculo, eliminarVehiculo } from "./vehiculos.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { validateIdParam } from "../../middlewares/validateId.middleware.js";
import { crearVehiculoSchema, actualizarVehiculoSchema } from "../../schemas/vehiculo.schema.js";

const router = express.Router();

/**
 * @swagger
 * /vehiculos:
 *   post:
 *     summary: Crear un nuevo vehiculo
 *     tags: [Vehiculos]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [placa, clienteId]
 *             properties:
 *               placa: { type: string }
 *               marca: { type: string }
 *               modelo: { type: string }
 *               color: { type: string }
 *               clienteId: { type: integer }
 *     responses:
 *       201:
 *         description: Vehiculo creado
 *       400:
 *         description: Error de validacion
 */
router.post("/", verificarToken, validate(crearVehiculoSchema), crearVehiculo);

/**
 * @swagger
 * /vehiculos:
 *   get:
 *     summary: Obtener lista de vehiculos
 *     tags: [Vehiculos]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de vehiculos
 */
router.get("/", verificarToken, obtenerVehiculos);

/**
 * @swagger
 * /vehiculos/{id}:
 *   get:
 *     summary: Obtener un vehiculo por ID
 *     tags: [Vehiculos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos del vehiculo
 *       404:
 *         description: Vehiculo no encontrado
 */
router.get("/:id", verificarToken, validateIdParam, obtenerVehiculo);
router.put("/:id", verificarToken, validateIdParam, validate(actualizarVehiculoSchema), actualizarVehiculo);

/**
 * @swagger
 * /vehiculos/{id}:
 *   delete:
 *     summary: Eliminar un vehiculo
 *     tags: [Vehiculos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Vehiculo eliminado
 *       404:
 *         description: Vehiculo no encontrado
 */
router.delete("/:id", verificarToken, validateIdParam, eliminarVehiculo);

export default router;

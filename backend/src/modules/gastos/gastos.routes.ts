import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { verificarRol } from "../../middlewares/roles.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { crearGastoSchema, actualizarGastoSchema } from "../../schemas/gasto.schema.js";
import { crearGasto, obtenerGastos, obtenerGasto, actualizarGasto, eliminarGasto, generarRecurrentes } from "./gastos.controller.js";

const router = express.Router();

/**
 * @swagger
 * /gastos:
 *   post:
 *     summary: Registrar un gasto
 *     tags: [Gastos]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [concepto, valor]
 *             properties:
 *               concepto: { type: string }
 *               categoria: { type: string }
 *               valor: { type: number }
 *     responses:
 *       201:
 *         description: Gasto registrado
 *       400:
 *         description: Error de validacion
 */
router.post("/", verificarToken, validate(crearGastoSchema), crearGasto);

/**
 * @swagger
 * /gastos:
 *   get:
 *     summary: Obtener lista de gastos
 *     tags: [Gastos]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de gastos
 */
router.get("/", verificarToken, obtenerGastos);

/**
 * @swagger
 * /gastos/{id}:
 *   get:
 *     summary: Obtener un gasto por ID
 *     tags: [Gastos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos del gasto
 *       404:
 *         description: Gasto no encontrado
 */
router.get("/:id", verificarToken, obtenerGasto);
router.post("/generar-recurrentes", verificarToken, generarRecurrentes);
router.put("/:id", verificarToken, validate(actualizarGastoSchema), actualizarGasto);

/**
 * @swagger
 * /gastos/{id}:
 *   delete:
 *     summary: Eliminar un gasto
 *     tags: [Gastos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Gasto eliminado
 *       404:
 *         description: Gasto no encontrado
 */
router.delete("/:id", verificarToken, eliminarGasto);

export default router;

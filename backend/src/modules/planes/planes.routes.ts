import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { verificarRol } from "../../middlewares/roles.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { crearPlanSchema, actualizarPlanSchema } from "../../schemas/plan.schema.js";
import { crearPlan, obtenerPlanes, obtenerPlan, actualizarPlan, eliminarPlan } from "./planes.controller.js";

const router = express.Router();

/**
 * @swagger
 * /planes:
 *   post:
 *     summary: Crear un nuevo plan
 *     tags: [Planes]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, duracionDias, valor]
 *             properties:
 *               nombre: { type: string }
 *               descripcion: { type: string }
 *               duracionDias: { type: integer }
 *               valor: { type: number }
 *     responses:
 *       201:
 *         description: Plan creado
 *       400:
 *         description: Error de validacion
 */
router.post("/", verificarToken, verificarRol("admin"), validate(crearPlanSchema), crearPlan);

/**
 * @swagger
 * /planes:
 *   get:
 *     summary: Obtener lista de planes
 *     tags: [Planes]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de planes
 */
router.get("/", verificarToken, obtenerPlanes);

/**
 * @swagger
 * /planes/{id}:
 *   get:
 *     summary: Obtener un plan por ID
 *     tags: [Planes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos del plan
 *       404:
 *         description: Plan no encontrado
 */
router.get("/:id", verificarToken, obtenerPlan);
router.put("/:id", verificarToken, verificarRol("admin"), validate(actualizarPlanSchema), actualizarPlan);

/**
 * @swagger
 * /planes/{id}:
 *   delete:
 *     summary: Eliminar un plan
 *     tags: [Planes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Plan eliminado
 *       404:
 *         description: Plan no encontrado
 */
router.delete("/:id", verificarToken, verificarRol("admin"), eliminarPlan);

export default router;

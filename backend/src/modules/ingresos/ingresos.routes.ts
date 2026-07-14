import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { crearIngresoSchema, actualizarIngresoSchema } from "../../schemas/ingreso.schema.js";
import {
  registrarIngreso,
  obtenerIngresos,
  obtenerIngreso,
  registrarSalida,
  liberarPuesto,
  actualizarIngreso,
  eliminarIngreso,
  simularCobro,
  registrarSalidaConCobro,
  ticketEntrada,
} from "./ingresos.controller.js";

const router = express.Router();

/**
 * @swagger
 * /ingresos:
 *   post:
 *     summary: Registrar ingreso de vehiculo
 *     tags: [Ingresos]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clienteId, vehiculoId, puestoId]
 *             properties:
 *               clienteId: { type: integer }
 *               vehiculoId: { type: integer }
 *               puestoId: { type: integer }
 *     responses:
 *       201:
 *         description: Ingreso registrado
 *       400:
 *         description: Error de validacion
 */
router.post("/", verificarToken, validate(crearIngresoSchema), registrarIngreso);

/**
 * @swagger
 * /ingresos:
 *   get:
 *     summary: Obtener lista de ingresos
 *     tags: [Ingresos]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de ingresos
 */
router.get("/", verificarToken, obtenerIngresos);

/**
 * @swagger
 * /ingresos/{id}:
 *   get:
 *     summary: Obtener un ingreso por ID
 *     tags: [Ingresos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos del ingreso
 *       404:
 *         description: Ingreso no encontrado
 */
router.get("/:id", verificarToken, obtenerIngreso);

/**
 * @swagger
 * /ingresos/salida/{id}:
 *   put:
 *     summary: Registrar salida de vehiculo
 *     tags: [Ingresos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Salida registrada
 *       400:
 *         description: Error al procesar salida
 */
router.put("/salida/:id", verificarToken, registrarSalida);
router.put("/liberar/:id", verificarToken, liberarPuesto);

/**
 * @swagger
 * /ingresos/simular-cobro:
 *   post:
 *     summary: Simular cobro antes de registrar salida
 *     tags: [Ingresos]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ingresoId: { type: integer }
 *     responses:
 *       200:
 *         description: Simulacion de cobro
 */
router.post("/simular-cobro", verificarToken, simularCobro);

/**
 * @swagger
 * /ingresos/salida-con-cobro/{id}:
 *   post:
 *     summary: Registrar salida con cobro
 *     tags: [Ingresos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Salida y cobro registrados
 */
router.post("/salida-con-cobro/:id", verificarToken, registrarSalidaConCobro);
router.put("/:id", verificarToken, validate(actualizarIngresoSchema), actualizarIngreso);

/**
 * @swagger
 * /ingresos/{id}:
 *   delete:
 *     summary: Eliminar un ingreso
 *     tags: [Ingresos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Ingreso eliminado
 */
router.delete("/:id", verificarToken, eliminarIngreso);

/**
 * @swagger
 * /ingresos/{id}/ticket:
 *   get:
 *     summary: Obtener ticket PDF de entrada
 *     tags: [Ingresos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: PDF del ticket
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/:id/ticket", verificarToken, ticketEntrada);

export default router;

import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { validateIdParam } from "../../middlewares/validateId.middleware.js";
import { crearReservaSchema, actualizarReservaSchema } from "../../schemas/reserva.schema.js";
import {
  crearReserva,
  obtenerReservas,
  obtenerReserva,
  actualizarReserva,
  cancelarReserva,
  cambiarEstado,
  eliminarReserva,
  liberarReservasVencidas,
} from "./reservas.controller.js";

const router = express.Router();

/**
 * @swagger
 * /reservas:
 *   post:
 *     summary: Crear una nueva reserva
 *     tags: [Reservas]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clienteId, vehiculoId, puestoId, fechaHoraInicio, fechaHoraFin]
 *             properties:
 *               clienteId: { type: integer }
 *               vehiculoId: { type: integer }
 *               puestoId: { type: integer }
 *               fechaHoraInicio: { type: string, format: date-time }
 *               fechaHoraFin: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Reserva creada
 *       400:
 *         description: Error de validacion
 */
router.post("/", verificarToken, validate(crearReservaSchema), crearReserva);

/**
 * @swagger
 * /reservas:
 *   get:
 *     summary: Obtener lista de reservas
 *     tags: [Reservas]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de reservas
 */
router.get("/", verificarToken, obtenerReservas);

/**
 * @swagger
 * /reservas/{id}:
 *   get:
 *     summary: Obtener una reserva por ID
 *     tags: [Reservas]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos de la reserva
 *       404:
 *         description: Reserva no encontrada
 */
router.get("/:id", verificarToken, validateIdParam, obtenerReserva);
router.put("/:id", verificarToken, validateIdParam, validate(actualizarReservaSchema), actualizarReserva);

/**
 * @swagger
 * /reservas/{id}/estado:
 *   put:
 *     summary: Cambiar estado de una reserva
 *     tags: [Reservas]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.put("/:id/estado", verificarToken, validateIdParam, cambiarEstado);

/**
 * @swagger
 * /reservas/cancelar/{id}:
 *   put:
 *     summary: Cancelar una reserva
 *     tags: [Reservas]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Reserva cancelada
 */
router.put("/cancelar/:id", verificarToken, validateIdParam, cancelarReserva);

/**
 * @swagger
 * /reservas/{id}:
 *   delete:
 *     summary: Eliminar una reserva
 *     tags: [Reservas]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Reserva eliminada
 */
router.delete("/:id", verificarToken, validateIdParam, eliminarReserva);

/**
 * @swagger
 * /reservas/liberar-vencidas:
 *   post:
 *     summary: Liberar reservas vencidas automaticamente
 *     tags: [Reservas]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Reservas vencidas liberadas
 */
router.post("/liberar-vencidas", verificarToken, liberarReservasVencidas);

export default router;

import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { crearCliente, obtenerClientes, obtenerCliente, actualizarCliente, eliminarCliente, perfilCliente, importarClientes, recargarSaldo } from "./clientes.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { validateIdParam } from "../../middlewares/validateId.middleware.js";
import { crearClienteSchema, actualizarClienteSchema } from "../../schemas/cliente.schema.js";

const router = express.Router();

/**
 * @swagger
 * /clientes:
 *   post:
 *     summary: Crear un nuevo cliente
 *     tags: [Clientes]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombres, apellidos, documento]
 *             properties:
 *               nombres: { type: string }
 *               apellidos: { type: string }
 *               documento: { type: string }
 *               telefono: { type: string }
 *               correo: { type: string }
 *     responses:
 *       201:
 *         description: Cliente creado
 *       400:
 *         description: Error de validacion
 */
router.post("/", verificarToken, validate(crearClienteSchema), crearCliente);

/**
 * @swagger
 * /clientes:
 *   get:
 *     summary: Obtener lista de clientes
 *     tags: [Clientes]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de clientes
 */
router.get("/", verificarToken, obtenerClientes);

/**
 * @swagger
 * /clientes/{id}:
 *   get:
 *     summary: Obtener un cliente por ID
 *     tags: [Clientes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos del cliente
 *       404:
 *         description: Cliente no encontrado
 */
router.get("/:id", verificarToken, validateIdParam, obtenerCliente);
router.put("/:id", verificarToken, validateIdParam, validate(actualizarClienteSchema), actualizarCliente);

/**
 * @swagger
 * /clientes/{id}:
 *   delete:
 *     summary: Eliminar un cliente
 *     tags: [Clientes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Cliente eliminado
 *       404:
 *         description: Cliente no encontrado
 */
router.delete("/:id", verificarToken, validateIdParam, eliminarCliente);

/**
 * @swagger
 * /clientes/{id}/perfil:
 *   get:
 *     summary: Obtener perfil completo del cliente con vehiculos e ingresos
 *     tags: [Clientes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Perfil del cliente
 */
router.get("/:id/perfil", verificarToken, validateIdParam, perfilCliente);
router.post("/importar", verificarToken, importarClientes);
router.post("/:id/recargar-saldo", verificarToken, validateIdParam, recargarSaldo);

export default router;

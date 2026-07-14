import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { verificarRol } from "../../middlewares/roles.middleware.js";
import { obtenerFacturas, obtenerFactura, descargarFacturaPDF, enviarWhatsapp, reciboSalida } from "./facturas.controller.js";

const router = express.Router();

/**
 * @swagger
 * /facturas:
 *   get:
 *     summary: Obtener lista de facturas
 *     tags: [Facturas]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de facturas
 */
router.get("/", verificarToken, obtenerFacturas);

/**
 * @swagger
 * /facturas/{id}:
 *   get:
 *     summary: Obtener una factura por ID
 *     tags: [Facturas]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos de la factura
 *       404:
 *         description: Factura no encontrada
 */
router.get("/:id", verificarToken, obtenerFactura);

/**
 * @swagger
 * /facturas/pdf/{id}:
 *   get:
 *     summary: Descargar factura en PDF
 *     tags: [Facturas]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: PDF de la factura
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/pdf/:id", verificarToken, descargarFacturaPDF);

/**
 * @swagger
 * /facturas/whatsapp/{id}:
 *   get:
 *     summary: Enviar factura por WhatsApp
 *     tags: [Facturas]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Factura enviada por WhatsApp
 */
router.get("/whatsapp/:id", verificarToken, enviarWhatsapp);

/**
 * @swagger
 * /facturas/{id}/recibo:
 *   get:
 *     summary: Obtener recibo de salida en PDF
 *     tags: [Facturas]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: PDF del recibo
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/:id/recibo", verificarToken, reciboSalida);

export default router;

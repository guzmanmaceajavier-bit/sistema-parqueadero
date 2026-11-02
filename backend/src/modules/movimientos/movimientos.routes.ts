import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { obtenerMovimientos } from "./movimientos.controller.js";

const router = express.Router();

// El historial es de solo lectura: las entradas se generan desde los módulos
// que ejecutan las acciones. No se permiten escrituras directas desde la API.
router.get("/", verificarToken, obtenerMovimientos);

export default router;

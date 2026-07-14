import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { subscribir, enviarNotificacion } from "./notificaciones.controller.js";
const router = express.Router();
router.post("/subscribir", verificarToken, subscribir);
router.post("/enviar", verificarToken, enviarNotificacion);
export default router;

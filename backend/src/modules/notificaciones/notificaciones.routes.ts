import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { verificarRol } from "../../middlewares/roles.middleware.js";
import { subscribir, enviarNotificacion } from "./notificaciones.controller.js";
const router = express.Router();
router.post("/subscribir", verificarToken, subscribir);
router.post("/enviar", verificarToken, verificarRol("admin", "supervisor"), enviarNotificacion);
export default router;

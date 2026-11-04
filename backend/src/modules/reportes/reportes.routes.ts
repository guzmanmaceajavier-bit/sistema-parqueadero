import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { verificarRol } from "../../middlewares/roles.middleware.js";
import { obtenerReporte } from "./reportes.controller.js";

const router = express.Router();

router.get("/", verificarToken, verificarRol("admin", "supervisor"), obtenerReporte);

export default router;

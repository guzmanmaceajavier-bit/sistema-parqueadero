import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { obtenerReporte } from "./reportes.controller.js";

const router = express.Router();

router.get("/", verificarToken, obtenerReporte);

export default router;

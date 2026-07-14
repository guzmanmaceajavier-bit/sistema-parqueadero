import express from "express";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { verificarRol } from "../../middlewares/roles.middleware.js";
import { listarSucursales, crearSucursal, actualizarSucursal } from "./sucursales.controller.js";
const router = express.Router();
router.get("/", verificarToken, listarSucursales);
router.post("/", verificarToken, verificarRol("admin"), crearSucursal);
router.put("/:id", verificarToken, verificarRol("admin"), actualizarSucursal);
export default router;

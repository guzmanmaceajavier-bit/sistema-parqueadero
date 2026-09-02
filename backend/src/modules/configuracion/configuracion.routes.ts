import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { verificarToken, verificarTokenOpcional } from "../../middlewares/auth.middleware.js";
import { verificarRol } from "../../middlewares/roles.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { actualizarConfiguracionSchema } from "../../schemas/configuracion.schema.js";
import { obtenerConfiguracion, guardarConfiguracion, formatearSistema } from "./configuracion.controller.js";
import * as service from "./configuracion.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "..", "..", "uploads");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error("Solo imagenes (jpg, png, gif, webp, svg)"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const fondoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `fondo-login-${Date.now()}${path.extname(file.originalname)}`),
});
const uploadFondo = multer({
  storage: fondoStorage,
  fileFilter: (req, file, cb) => {
    const allowedExt = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i;
    const allowedMime = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp"];
    if (allowedExt.test(path.extname(file.originalname)) || allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato no soportado: " + (file.mimetype || file.originalname)));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = express.Router();

/**
 * @swagger
 * /configuracion:
 *   get:
 *     summary: Obtener configuracion del sistema
 *     tags: [Configuracion]
 *     responses:
 *       200:
 *         description: Configuracion actual
 */
router.get("/", verificarTokenOpcional, obtenerConfiguracion);

/**
 * @swagger
 * /configuracion:
 *   post:
 *     summary: Guardar configuracion del sistema
 *     tags: [Configuracion]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombreParqueadero: { type: string }
 *               direccion: { type: string }
 *               telefono: { type: string }
 *     responses:
 *       200:
 *         description: Configuracion guardada
 */
router.post("/", verificarToken, validate(actualizarConfiguracionSchema), guardarConfiguracion);

/**
 * @swagger
 * /configuracion/formatear:
 *   post:
 *     summary: Formatear sistema (eliminar todos los datos)
 *     tags: [Configuracion]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Sistema formateado
 */
router.post("/formatear", verificarToken, verificarRol("admin"), formatearSistema);

/**
 * @swagger
 * /configuracion/upload-logo:
 *   post:
 *     summary: Subir logo del parqueadero
 *     tags: [Configuracion]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               logo: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Logo subido correctamente
 */
router.post("/upload-logo", verificarToken, (req, res) => {
  upload.single("logo")(req, res, async (err) => {
    if (err) return res.status(400).json({ ok: false, message: err.message });
    if (!req.file) return res.status(400).json({ ok: false, message: "No se envió ninguna imagen" });

    const logoUrl = `/uploads/${req.file.filename}`;
    const existe = await service.obtenerConfiguracion();
    if (existe) {
      if (existe.logo) {
        const oldPath = path.join(uploadDir, path.basename(existe.logo));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      await service.actualizarConfiguracion(existe.id, { logo: logoUrl });
    }
    res.json({ ok: true, logo: logoUrl });
  });
});

/**
 * @swagger
 * /configuracion/logo:
 *   delete:
 *     summary: Eliminar logo del parqueadero
 *     tags: [Configuracion]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logo eliminado
 */
router.delete("/logo", verificarToken, async (req, res) => {
  const existe = await service.obtenerConfiguracion();
  if (existe?.logo) {
    const oldPath = path.join(uploadDir, path.basename(existe.logo));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    await service.actualizarConfiguracion(existe.id, { logo: null });
  }
  res.json({ ok: true, message: "Logo eliminado" });
});

/**
 * @swagger
 * /configuracion/upload-fondo:
 *   post:
 *     summary: Subir fondo de pantalla para login
 *     tags: [Configuracion]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fondo: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Fondo subido correctamente
 */
router.post("/upload-fondo", verificarToken, (req, res) => {
  uploadFondo.single("fondo")(req, res, async (err) => {
    if (err) return res.status(400).json({ ok: false, message: err.message });
    if (!req.file) return res.status(400).json({ ok: false, message: "No se envio ninguna imagen" });

    try {
      const fondoUrl = `/uploads/${req.file.filename}`;
      const existe = await service.obtenerConfiguracion();
      if (existe) {
        if (existe.fondoLogin) {
          const oldPath = path.join(uploadDir, path.basename(existe.fondoLogin));
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        await service.actualizarConfiguracion(existe.id, { fondoLogin: fondoUrl });
      }
      res.json({ ok: true, fondoLogin: fondoUrl });
    } catch (error) {
      console.error("Error al subir fondo:", error);
      res.status(500).json({ ok: false, message: error.message });
    }
  });
});

/**
 * @swagger
 * /configuracion/fondo:
 *   delete:
 *     summary: Eliminar fondo de login
 *     tags: [Configuracion]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Fondo eliminado
 */
router.delete("/fondo", verificarToken, async (req, res) => {
  try {
    const existe = await service.obtenerConfiguracion();
    if (existe?.fondoLogin) {
      const oldPath = path.join(uploadDir, path.basename(existe.fondoLogin));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      await service.actualizarConfiguracion(existe.id, { fondoLogin: null });
    }
    res.json({ ok: true, message: "Fondo de login eliminado" });
  } catch (error) {
    console.error("Error al eliminar fondo:", error);
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/fix-listas", verificarToken, verificarRol("admin"), async (req, res) => {
  try {
    const config = await service.obtenerConfiguracion();
    if (!config) return res.json({ ok: true, message: "No hay configuracion" });

    const updates: Record<string, unknown> = {};

    if (config.formatoHora === "24h") {
      updates.formatoHora = "12h";
    }

    if (config.listasConfiguracion && typeof config.listasConfiguracion === "object") {
      const listas = JSON.parse(JSON.stringify(config.listasConfiguracion));
      if (listas.tiposVehiculo && Array.isArray(listas.tiposVehiculo)) {
        listas.tiposVehiculo = listas.tiposVehiculo.map((item: { value: string; label: string }) => {
          if (item.value === "aviones" || item.label?.toLowerCase() === "aviones") {
            return { value: "avion", label: "Avion" };
          }
          return item;
        });
      }
      updates.listasConfiguracion = listas;
    }

    if (Object.keys(updates).length > 0) {
      await service.actualizarConfiguracion(config.id, updates);
    }

    res.json({ ok: true, message: "Datos corregidos", updates });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

export default router;

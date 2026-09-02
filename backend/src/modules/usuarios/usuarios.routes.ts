import express from "express";
import rateLimit from "express-rate-limit";
import { verificarToken } from "../../middlewares/auth.middleware.js";
import { verificarRol } from "../../middlewares/roles.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { crearUsuarioSchema, loginSchema, actualizarUsuarioSchema, cambiarEstadoUsuarioSchema, solicitarResetPasswordSchema, resetPasswordSchema, verificarPasswordSchema } from "../../schemas/usuario.schema.js";
import { login, crearUsuario, crearAdmin, obtenerPerfil, obtenerUsuarios, obtenerAccesos, actualizarUsuario, cambiarEstadoUsuario, eliminarUsuario, solicitarResetPassword, resetPassword, verificarPassword, invalidarSesiones, refreshToken, logout } from "./usuarios.controller.js";
import prisma from "../../config/prisma.js";

const router = express.Router();

let currentMaxLoginAttempts = 10;

async function updateLoginAttempts() {
  try {
    const config = await prisma.configuracion.findFirst();
    currentMaxLoginAttempts = config?.intentosMaximos ?? 10;
  } catch {}
}
updateLoginAttempts();
setInterval(updateLoginAttempts, 30000);

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => currentMaxLoginAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Demasiados intentos de inicio de sesión. Intente de nuevo en un minuto." },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Demasiadas solicitudes de recuperación. Intente de nuevo en un minuto." },
});

/**
 * @swagger
 * /usuarios/login:
 *   post:
 *     summary: Iniciar sesion
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usuario: { type: string }
 *               correo: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Credenciales incorrectas
 */
router.post("/login", loginLimiter, validate(loginSchema), login);

if (process.env.NODE_ENV !== "production") {
  router.get("/test-credentials", async (_req, res) => {
    try {
      const users = await prisma.usuario.findMany({
        select: { usuario: true, correo: true, rol: true },
        take: 5,
      });
      res.json({ ok: true, credentials: users.map(u => ({ usuario: u.usuario, password: "admin123", rol: u.rol })) });
    } catch { res.json({ ok: true, credentials: [{ usuario: "admin", password: "admin123", rol: "admin" }] }); }
  });
}

/**
 * @swagger
 * /usuarios:
 *   post:
 *     summary: Crear un nuevo usuario (admin)
 *     tags: [Usuarios]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, usuario, correo, password]
 *             properties:
 *               nombre: { type: string }
 *               usuario: { type: string }
 *               correo: { type: string }
 *               password: { type: string }
 *               rol: { type: string, enum: [admin, supervisor, empleado] }
 *     responses:
 *       201:
 *         description: Usuario creado
 *       400:
 *         description: Error de validacion
 */
router.post("/", verificarToken, verificarRol("admin"), validate(crearUsuarioSchema), crearUsuario);
router.post("/crear-admin", rateLimit({ windowMs: 60 * 60 * 1000, max: 3, message: { ok: false, message: "Demasiados intentos. Intente de nuevo en 1 hora." } }), validate(crearUsuarioSchema), crearAdmin);

/**
 * @swagger
 * /usuarios/forgot-password:
 *   post:
 *     summary: Solicitar restablecimiento de contraseña
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usuario: { type: string }
 *               correo: { type: string }
 *     responses:
 *       200:
 *         description: Correo de recuperacion enviado
 *       404:
 *         description: Usuario no encontrado
 */
router.post("/forgot-password", forgotPasswordLimiter, validate(solicitarResetPasswordSchema), solicitarResetPassword);

/**
 * @swagger
 * /usuarios/reset-password:
 *   post:
 *     summary: Restablecer contraseña con token
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Contraseña restablecida
 *       400:
 *         description: Token invalido o expirado
 */
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.post("/verificar-password", verificarToken, validate(verificarPasswordSchema), verificarPassword);

/**
 * @swagger
 * /usuarios/refresh-token:
 *   post:
 *     summary: Refrescar token de sesion
 *     tags: [Usuarios]
 *     responses:
 *       200:
 *         description: Token renovado
 *       401:
 *         description: Token invalido
 */
router.post("/refresh-token", refreshToken);

/**
 * @swagger
 * /usuarios/logout:
 *   post:
 *     summary: Cerrar sesion
 *     tags: [Usuarios]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Sesion cerrada
 */
router.post("/logout", verificarToken, logout);
router.post("/invalidar-sesiones", verificarToken, invalidarSesiones);

/**
 * @swagger
 * /usuarios/perfil:
 *   get:
 *     summary: Obtener perfil del usuario autenticado
 *     tags: [Usuarios]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Datos del perfil
 *       401:
 *         description: No autenticado
 */
router.get("/perfil", verificarToken, obtenerPerfil);

/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Obtener lista de usuarios (admin)
 *     tags: [Usuarios]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *       403:
 *         description: No autorizado
 */
router.get("/", verificarToken, verificarRol("admin"), obtenerUsuarios);
router.get("/accesos", verificarToken, verificarRol("admin"), obtenerAccesos);
router.put("/:id", verificarToken, verificarRol("admin"), validate(actualizarUsuarioSchema), actualizarUsuario);
router.put("/estado/:id", verificarToken, verificarRol("admin"), validate(cambiarEstadoUsuarioSchema), cambiarEstadoUsuario);

/**
 * @swagger
 * /usuarios/{id}:
 *   delete:
 *     summary: Eliminar un usuario (admin)
 *     tags: [Usuarios]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Usuario eliminado
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 */
router.delete("/:id", verificarToken, verificarRol("admin"), eliminarUsuario);

export default router;

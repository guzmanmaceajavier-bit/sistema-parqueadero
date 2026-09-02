import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../../config/prisma.js";
import { asyncHandler, AppError } from "../../middlewares/error.middleware.js";
import { paginate } from "../../utils/pagination.js";
import { registrarMovimiento } from "../../helpers/movimientos.js";
import { sendResetPasswordEmail } from "../../services/mail.service.js";

const RESET_EXPIRES_MIN = 60;

const JWT_SECRET = process.env.JWT_SECRET;

export const login = asyncHandler(async (req, res) => {
  const { usuario, correo, password } = req.body;

  const usuarioDb = await prisma.usuario.findFirst({
    where: { OR: [{ usuario }, { correo }].filter(Boolean) },
  });

  if (!usuarioDb || !usuarioDb.estado || (usuarioDb.bloqueadoHasta && new Date() < usuarioDb.bloqueadoHasta)) {
    throw new AppError("Credenciales incorrectas", 401);
  }

  const valid = await bcrypt.compare(password, usuarioDb.password);
  const ip = req.ip || req.connection?.remoteAddress;
  const dispositivo = req.headers["user-agent"];
  const NODE_ENV = process.env.NODE_ENV || "development";

  if (!valid) {
    const nuevosIntentos = usuarioDb.intentosFallidos + 1;
    const data = { intentosFallidos: nuevosIntentos };
    await prisma.acceso.create({
      data: { usuarioId: usuarioDb.id, usuario: usuarioDb.usuario, actividad: "INICIO SESIÓN FALLIDO", ip, dispositivo },
    });
    if (nuevosIntentos >= 5) {
      data.bloqueadoHasta = new Date(Date.now() + 15 * 60 * 1000);
      data.intentosFallidos = 0;
      await prisma.usuario.update({ where: { id: usuarioDb.id }, data });
      throw new AppError("Credenciales incorrectas", 401);
    }
    await prisma.usuario.update({ where: { id: usuarioDb.id }, data });
    throw new AppError(`Credenciales incorrectas. Te quedan ${5 - nuevosIntentos} intento(s).`, 401);
  }

  await prisma.usuario.update({
    where: { id: usuarioDb.id },
    data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() },
  });

  const token = jwt.sign(
    { id: usuarioDb.id, usuario: usuarioDb.usuario, rol: usuarioDb.rol, tokenVersion: usuarioDb.tokenVersion },
    JWT_SECRET,
    { expiresIn: "4h" }
  );

  await prisma.acceso.create({
    data: { usuarioId: usuarioDb.id, usuario: usuarioDb.usuario, actividad: "INICIO SESIÓN", ip, dispositivo },
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    ok: true,
    usuario: { id: usuarioDb.id, nombre: usuarioDb.nombre, usuario: usuarioDb.usuario, correo: usuarioDb.correo, rol: usuarioDb.rol },
  });
});

export const crearUsuario = asyncHandler(async (req, res) => {
  const { nombre, usuario, correo, password, rol } = req.body;

  const existe = await prisma.usuario.findFirst({
    where: { OR: [{ usuario }, { correo }] },
  });
  if (existe) throw new AppError("El usuario o correo ya existe", 400);

  const hash = await bcrypt.hash(password, 12);
  const nuevo = await prisma.usuario.create({
    data: { nombre, usuario, correo, password: hash, rol: rol || "empleado" },
  });
  res.status(201).json({ ok: true, message: "Usuario creado", usuario: { id: nuevo.id, nombre: nuevo.nombre, usuario: nuevo.usuario, rol: nuevo.rol } });
});

export const crearAdmin = asyncHandler(async (req, res) => {
  const adminExiste = await prisma.usuario.findFirst({ where: { rol: "admin" } });
  if (adminExiste) throw new AppError("Ya existe un administrador. Use la autenticación normal.", 403);

  const { nombre, usuario, correo, password } = req.body;
  const existe = await prisma.usuario.findFirst({
    where: { OR: [{ usuario }, { correo }] },
  });
  if (existe) throw new AppError("El usuario o correo ya existe", 400);

  const hash = await bcrypt.hash(password, 12);
  const nuevo = await prisma.usuario.create({
    data: { nombre, usuario, correo, password: hash, rol: "admin" },
  });
  res.status(201).json({ ok: true, message: "Administrador creado", usuario: { id: nuevo.id, nombre: nuevo.nombre, usuario: nuevo.usuario, rol: nuevo.rol } });
});

export const obtenerUsuarios = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const select = { id: true, nombre: true, usuario: true, correo: true, rol: true, estado: true, ultimoAcceso: true, createdAt: true };
  if (page) {
    const { data: usuarios, pagination } = await paginate(prisma, "usuario", {
      page, limit, select, orderBy: { id: "desc" },
    });
    return res.json({ ok: true, usuarios, pagination });
  }
  const usuarios = await prisma.usuario.findMany({ select, orderBy: { id: "desc" } });
  res.json({ ok: true, usuarios });
});

export const obtenerPerfil = asyncHandler(async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    select: { id: true, nombre: true, usuario: true, correo: true, rol: true, estado: true, ultimoAcceso: true, createdAt: true },
  });
  res.json({ ok: true, usuario });
});

export const obtenerAccesos = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { data: accesos, pagination } = await paginate(prisma, "acceso", {
    page, limit,
    include: { usuarioRel: { select: { nombre: true, usuario: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ ok: true, accesos, pagination });
});

export const actualizarUsuario = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, rol, password } = req.body;

  const existe = await prisma.usuario.findUnique({ where: { id: Number(id) } });
  if (!existe) throw new AppError("Usuario no encontrado", 404);

  const data = {};
  if (nombre) data.nombre = nombre;
  if (correo) data.correo = correo;
  if (rol) data.rol = rol;
  if (password) data.password = await bcrypt.hash(password, 12);

  const usuario = await prisma.usuario.update({
    where: { id: Number(id) }, data,
    select: { id: true, nombre: true, usuario: true, correo: true, rol: true, estado: true },
  });
  res.json({ ok: true, usuario });
});

export const cambiarEstadoUsuario = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  const existe = await prisma.usuario.findUnique({ where: { id: Number(id) } });
  if (!existe) throw new AppError("Usuario no encontrado", 404);

  const usuario = await prisma.usuario.update({
    where: { id: Number(id) }, data: { estado },
    select: { id: true, nombre: true, usuario: true, rol: true, estado: true },
  });
  res.json({ ok: true, usuario });
});

export const eliminarUsuario = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const targetId = Number(id);
  if (targetId === req.usuario.id) {
    throw new AppError("No puedes eliminar tu propia cuenta", 400);
  }
  const adminCount = await prisma.usuario.count({ where: { rol: "admin", estado: true } });
  const target = await prisma.usuario.findUnique({ where: { id: targetId }, select: { rol: true } });
  if (target?.rol === "admin" && adminCount <= 1) {
    throw new AppError("No puedes eliminar el último administrador", 400);
  }
  await prisma.usuario.delete({ where: { id: targetId } });
  res.json({ ok: true, message: "Usuario eliminado" });
});

export const solicitarResetPassword = asyncHandler(async (req, res) => {
  const { usuario, correo } = req.body;
  if (!usuario && !correo) throw new AppError("Debes proporcionar usuario o correo", 400);

  const user = await prisma.usuario.findFirst({
    where: { OR: [{ usuario }, { correo }].filter(Boolean) },
  });
  if (!user) throw new AppError("Usuario no encontrado", 404);
  if (!user.estado) throw new AppError("Usuario inactivo", 403);

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + RESET_EXPIRES_MIN * 60000);

  await prisma.usuario.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpires: expires },
  });

  try {
    await sendResetPasswordEmail(user.correo, user.nombre, token);
  } catch (emailError) {
    console.error("Error enviando email:", emailError.message);
  }

  res.json({
    ok: true,
    message: "Si el usuario existe, recibira un enlace para restablecer su contrasena en su correo electronico.",
  });
});

export const verificarPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
  if (!usuario) throw new AppError("Usuario no encontrado", 404);
  const valida = await bcrypt.compare(password, usuario.password);
  if (!valida) throw new AppError("Contraseña incorrecta", 401);
  res.json({ ok: true, message: "Contraseña verificada" });
});

export const invalidarSesiones = asyncHandler(async (req, res) => {
  const usuario = await prisma.usuario.update({
    where: { id: req.usuario.id },
    data: { tokenVersion: { increment: 1 } },
  });
  await registrarMovimiento("Usuarios", "SESIONES INVALIDADAS", `Todas las sesiones de ${usuario.usuario} fueron invalidadas`, req.usuario.usuario);
  res.json({ ok: true, message: "Todas las sesiones fueron invalidadas" });
});

export const logout = asyncHandler(async (req, res) => {
  const NODE_ENV = process.env.NODE_ENV || "development";
  await prisma.usuario.update({
    where: { id: req.usuario.id },
    data: { tokenVersion: { increment: 1 } },
  });
  res.clearCookie("token", { httpOnly: true, secure: NODE_ENV === "production", sameSite: NODE_ENV === "production" ? "none" : "lax", path: "/" });
  res.json({ ok: true, message: "Sesion cerrada" });
});

export const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
  if (!token) {
    throw new AppError("Token requerido", 401);
  }
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new AppError("Token invalido o expirado", 401);
  }
  const usuario = await prisma.usuario.findUnique({ where: { id: decoded.id } });
  if (!usuario || !usuario.estado) throw new AppError("Usuario no encontrado o inactivo", 401);
  if (usuario.tokenVersion !== decoded.tokenVersion) {
    throw new AppError("Sesion invalidada. Inicia sesion nuevamente.", 401);
  }
  const nuevoToken = jwt.sign(
    { id: usuario.id, usuario: usuario.usuario, rol: usuario.rol, tokenVersion: usuario.tokenVersion },
    JWT_SECRET,
    { expiresIn: "4h" }
  );
  const NODE_ENV = process.env.NODE_ENV || "development";
  res.cookie("token", nuevoToken, {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw new AppError("Token y contraseña son requeridos", 400);

  const user = await prisma.usuario.findFirst({
    where: { resetToken: token, resetTokenExpires: { gte: new Date() } },
  });
  if (!user) throw new AppError("Token inválido o expirado", 400);

  const hash = await bcrypt.hash(password, 12);
  await prisma.usuario.update({
    where: { id: user.id },
    data: { password: hash, resetToken: null, resetTokenExpires: null, intentosFallidos: 0, bloqueadoHasta: null, tokenVersion: { increment: 1 } },
  });

  res.json({ ok: true, message: "Contraseña actualizada exitosamente. Todas las sesiones fueron cerradas." });
});

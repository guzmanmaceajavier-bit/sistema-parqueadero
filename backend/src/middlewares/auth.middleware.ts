import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("JWT_SECRET no está definido en las variables de entorno");
  process.exit(1);
}

export const verificarToken = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: "Token no proporcionado",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;

    const user = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { tokenVersion: true, estado: true },
    });

    if (!user) {
      return res.status(401).json({ ok: false, message: "Usuario no encontrado" });
    }

    if (!user.estado) {
      return res.status(401).json({ ok: false, message: "Usuario desactivado" });
    }

    if (user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ ok: false, message: "Sesión expirada, inicie sesión nuevamente" });
    }

    next();
  } catch {
    return res.status(401).json({
      ok: false,
      message: "Token inválido",
    });
  }
};

export const verificarTokenOpcional = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
    if (!token) return next();
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { tokenVersion: true, estado: true },
    });

    if (user && user.estado && user.tokenVersion === decoded.tokenVersion) {
      req.usuario = decoded;
    }
  } catch {
    // Token inválido o expirado, continuar como anónimo
  }
  next();
};
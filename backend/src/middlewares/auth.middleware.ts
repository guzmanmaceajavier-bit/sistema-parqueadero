import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import prisma from "../config/prisma.js";

type AuthTokenPayload = jwt.JwtPayload & {
  id: number;
  tokenVersion: number;
  usuario?: string;
  rol?: string;
};

const JWT_SECRET: string = process.env.JWT_SECRET || "";

if (!JWT_SECRET) {
  console.error("JWT_SECRET no está definido en las variables de entorno");
  process.exit(1);
}

export const verificarToken: RequestHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: "Token no proporcionado",
      });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === "string" || typeof payload.id !== "number" || typeof payload.tokenVersion !== "number") {
      return res.status(401).json({ ok: false, message: "Token inválido" });
    }
    const decoded = payload as AuthTokenPayload;
    const user = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { tokenVersion: true, estado: true, rol: true, sucursalId: true },
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

    // El rol y la sucursal se toman de la base de datos, nunca de claims antiguos.
    req.usuario = { ...decoded, rol: user.rol, sucursalId: user.sucursalId };
    return next();
  } catch {
    return res.status(401).json({
      ok: false,
      message: "Token inválido",
    });
  }
};

export const verificarTokenOpcional: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
    if (!token) return next();

    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === "string" || typeof payload.id !== "number" || typeof payload.tokenVersion !== "number") {
      return next();
    }
    const decoded = payload as AuthTokenPayload;
    const user = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { tokenVersion: true, estado: true, rol: true, sucursalId: true },
    });

    if (user && user.estado && user.tokenVersion === decoded.tokenVersion) {
      req.usuario = { ...decoded, rol: user.rol, sucursalId: user.sucursalId };
    }
  } catch {
    // Token inválido o expirado, continuar como anónimo.
  }
  return next();
};

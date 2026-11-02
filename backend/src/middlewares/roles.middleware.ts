import type { RequestHandler } from "express";

/**
 * Verifica roles después de verificarToken. La ausencia de identidad es un
 * rechazo de autenticación (401), no un error interno (500).
 */
export const verificarRol = (...rolesPermitidos: string[]): RequestHandler => {
  return (req, res, next) => {
    const rolUsuario = req.usuario?.rol;

    if (!rolUsuario) {
      return res.status(401).json({
        ok: false,
        message: "Autenticación requerida",
      });
    }

    if (!rolesPermitidos.includes(rolUsuario)) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para realizar esta acción",
      });
    }

    return next();
  };
};

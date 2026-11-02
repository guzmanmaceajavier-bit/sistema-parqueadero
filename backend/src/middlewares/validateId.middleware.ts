import type { RequestHandler } from "express";

export const validateIdParam: RequestHandler = (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, message: "ID inválido" });
  }
  return next();
};

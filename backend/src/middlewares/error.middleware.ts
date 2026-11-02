import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

export const errorHandler: ErrorRequestHandler = (err: any, req, res, next) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({ ok: false, message: err.message });
  }

  if (err.name === "ZodError") {
    return res.status(400).json({
      ok: false,
      message: "Error de validación",
      errors: err.errors.map((e: any) => ({ field: e.path.join("."), message: e.message })),
    });
  }

  if (err.code === "P2002") {
    return res.status(409).json({ ok: false, message: "El registro ya existe (valor duplicado)" });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ ok: false, message: "Registro no encontrado" });
  }

  console.error("ERROR:", err);
  res.status(500).json({
    ok: false,
    message: process.env.NODE_ENV === "production" ? "Error interno del servidor" : err.message,
  });
};

type AsyncController = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler = (fn: AsyncController): RequestHandler => (req, res, next) => {
  void Promise.resolve(fn(req, res, next)).catch(next);
};

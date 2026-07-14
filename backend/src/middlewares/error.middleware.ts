export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

export const errorHandler = (err, req, res, next) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({ ok: false, message: err.message });
  }

  if (err.name === "ZodError") {
    return res.status(400).json({
      ok: false,
      message: "Error de validación",
      errors: err.errors.map(e => ({ field: e.path.join("."), message: e.message })),
    });
  }

  if (err.code === "P2002") {
    return res.status(409).json({ ok: false, message: "El registro ya existe (valor duplicado)" });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ ok: false, message: "Registro no encontrado" });
  }

  console.error("ERROR:", err);
  res.status(500).json({ ok: false, message: process.env.NODE_ENV === "production" ? "Error interno del servidor" : err.message });
};

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

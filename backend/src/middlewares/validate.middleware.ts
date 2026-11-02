import type { RequestHandler } from "express";
import { ZodError, type ZodTypeAny } from "zod";

export const validate = (schema: ZodTypeAny): RequestHandler => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    return next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        ok: false,
        message: "Error de validación",
        errors: error.issues.map(issue => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return next(error);
  }
};

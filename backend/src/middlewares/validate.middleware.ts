export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        ok: false,
        message: "Error de validación",
        errors: error.errors.map(e => ({ field: e.path.join("."), message: e.message })),
      });
    }
    next(error);
  }
};

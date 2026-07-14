import { asyncHandler, AppError } from "./error.middleware.js";

export const filtrarSucursal = (modelName: string) => {
  return asyncHandler(async (req, res, next) => {
    const sucursalId = req.usuario?.sucursalId;
    if (sucursalId) {
      req.query.sucursalId = String(sucursalId);
    }
    next();
  });
};

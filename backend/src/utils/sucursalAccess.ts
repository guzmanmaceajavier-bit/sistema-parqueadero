import { AppError } from "../middlewares/error.middleware.js";

type UsuarioConSucursal = {
  rol?: string;
  sucursalId?: number | null;
};

/**
 * Administradores pueden consultar una sucursal concreta o todas.
 * Los demás roles quedan limitados a su sucursal asignada; sin asignación
 * se deniega el acceso en vez de devolver datos globales.
 */
export function resolverSucursalPermitida(usuario: UsuarioConSucursal | undefined, solicitada: unknown): number | undefined {
  if (!usuario?.rol) throw new AppError("Autenticación requerida", 401);

  let idSolicitado: number | undefined;
  if (solicitada !== undefined && solicitada !== null && solicitada !== "") {
    idSolicitado = Number(solicitada);
    if (!Number.isSafeInteger(idSolicitado) || idSolicitado <= 0) {
      throw new AppError("La sucursal seleccionada no es válida", 400);
    }
  }

  if (usuario.rol === "admin") return idSolicitado;

  const asignada = usuario.sucursalId;
  if (!Number.isSafeInteger(asignada) || !asignada || asignada <= 0) {
    throw new AppError("Tu usuario no tiene una sucursal asignada. Solicita al administrador que la configure.", 403);
  }
  if (idSolicitado !== undefined && idSolicitado !== asignada) {
    throw new AppError("No tienes permisos para consultar otra sucursal", 403);
  }
  return asignada;
}

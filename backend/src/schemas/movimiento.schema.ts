import { z } from "zod";

export const crearMovimientoSchema = z.object({
  modulo: z.string().trim().min(1, "Módulo es requerido").max(50),
  accion: z.string().trim().min(1, "Acción es requerida").max(50),
  descripcion: z.string().trim().min(1, "Descripción es requerida").max(500),
  usuario: z.string().trim().optional().max(50),
});

export const actualizarMovimientoSchema = z.object({
  modulo: z.string().trim().optional().max(50),
  accion: z.string().trim().optional().max(50),
  descripcion: z.string().trim().optional().max(500),
});

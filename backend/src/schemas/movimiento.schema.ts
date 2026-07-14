import { z } from "zod";

export const crearMovimientoSchema = z.object({
  modulo: z.string().min(1, "Módulo es requerido"),
  accion: z.string().min(1, "Acción es requerida"),
  descripcion: z.string().min(1, "Descripción es requerida"),
  usuario: z.string().optional(),
});

export const actualizarMovimientoSchema = z.object({
  modulo: z.string().optional(),
  accion: z.string().optional(),
  descripcion: z.string().optional(),
});

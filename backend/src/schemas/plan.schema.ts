import { z } from "zod";

export const crearPlanSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre es requerido").max(100),
  descripcion: z.string().trim().max(500).optional().nullable(),
  duracionDias: z.coerce.number().int().positive("Duración debe ser positiva"),
  valor: z.coerce.number().positive("Valor debe ser positivo"),
  tipoVehiculo: z.string().trim().max(50).optional().default("todos"),
});

export const actualizarPlanSchema = z.object({
  nombre: z.string().trim().max(100).optional(),
  descripcion: z.string().trim().max(500).optional().nullable(),
  duracionDias: z.coerce.number().int().positive().optional(),
  valor: z.coerce.number().positive().optional(),
  tipoVehiculo: z.string().trim().max(50).optional(),
  activo: z.boolean().optional(),
});

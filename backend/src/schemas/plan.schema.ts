import { z } from "zod";

export const crearPlanSchema = z.object({
  nombre: z.string().min(1, "Nombre es requerido"),
  descripcion: z.string().optional().nullable(),
  duracionDias: z.coerce.number().int().positive("Duración debe ser positiva"),
  valor: z.coerce.number().positive("Valor debe ser positivo"),
  tipoVehiculo: z.string().optional().default("todos"),
});

export const actualizarPlanSchema = z.object({
  nombre: z.string().optional(),
  descripcion: z.string().optional().nullable(),
  duracionDias: z.coerce.number().int().positive().optional(),
  valor: z.coerce.number().positive().optional(),
  tipoVehiculo: z.string().optional(),
  activo: z.boolean().optional(),
});

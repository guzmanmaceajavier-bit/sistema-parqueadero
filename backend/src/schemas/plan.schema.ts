import { z } from "zod";

export const crearPlanSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre es requerido").max(100),
  descripcion: z.string().trim().optional().nullable().max(500),
  duracionDias: z.coerce.number().int().positive("Duración debe ser positiva"),
  valor: z.coerce.number().positive("Valor debe ser positivo"),
  tipoVehiculo: z.string().trim().optional().default("todos").max(50),
});

export const actualizarPlanSchema = z.object({
  nombre: z.string().trim().optional().max(100),
  descripcion: z.string().trim().optional().nullable().max(500),
  duracionDias: z.coerce.number().int().positive().optional(),
  valor: z.coerce.number().positive().optional(),
  tipoVehiculo: z.string().trim().optional().max(50),
  activo: z.boolean().optional(),
});

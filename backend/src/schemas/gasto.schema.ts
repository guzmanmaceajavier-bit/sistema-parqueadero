import { z } from "zod";

export const crearGastoSchema = z.object({
  concepto: z.string().trim().min(3, "Concepto debe tener al menos 3 caracteres").max(200),
  descripcion: z.string().trim().optional().nullable().max(500),
  categoria: z.string().trim().optional().default("otros").max(50),
  valor: z.coerce.number().positive("Valor debe ser positivo"),
  recurrente: z.boolean().optional().default(false),
  periodicidad: z.string().trim().optional().default("mensual").max(30),
});

export const actualizarGastoSchema = z.object({
  concepto: z.string().trim().min(3).max(200).optional(),
  descripcion: z.string().trim().optional().nullable().max(500),
  categoria: z.string().trim().optional().max(50),
  valor: z.coerce.number().positive().optional(),
  recurrente: z.boolean().optional(),
  periodicidad: z.string().trim().optional().max(30),
});

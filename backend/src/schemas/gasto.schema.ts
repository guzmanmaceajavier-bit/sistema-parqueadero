import { z } from "zod";

export const actualizarGastoSchema = z.object({
  concepto: z.string().min(3).optional(),
  descripcion: z.string().optional().nullable(),
  categoria: z.string().optional(),
  valor: z.coerce.number().positive().optional(),
  recurrente: z.boolean().optional(),
  periodicidad: z.string().optional(),
});

export const crearGastoSchema = z.object({
  concepto: z.string().min(3, "Concepto debe tener al menos 3 caracteres"),
  descripcion: z.string().optional().nullable(),
  categoria: z.string().optional().default("otros"),
  valor: z.coerce.number().positive("Valor debe ser positivo"),
  recurrente: z.boolean().optional().default(false),
  periodicidad: z.string().optional().default("mensual"),
});

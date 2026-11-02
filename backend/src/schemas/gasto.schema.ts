import { z } from "zod";

const periodicidadSchema = z.enum(["semanal", "mensual", "anual"]);

export const crearGastoSchema = z.object({
  concepto: z.string().trim().min(3, "Concepto debe tener al menos 3 caracteres").max(200),
  descripcion: z.string().trim().max(500).optional().nullable(),
  categoria: z.string().trim().max(50).optional().default("otros"),
  valor: z.coerce.number().finite().positive("Valor debe ser positivo"),
  recurrente: z.boolean().optional().default(false),
  periodicidad: periodicidadSchema.optional().default("mensual"),
});

export const actualizarGastoSchema = z.object({
  concepto: z.string().trim().min(3).max(200).optional(),
  descripcion: z.string().trim().max(500).optional().nullable(),
  categoria: z.string().trim().max(50).optional(),
  valor: z.coerce.number().finite().positive().optional(),
  recurrente: z.boolean().optional(),
  periodicidad: periodicidadSchema.optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Debes indicar al menos un campo para actualizar",
});

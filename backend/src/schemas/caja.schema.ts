import { z } from "zod";

export const abrirCajaSchema = z.object({
  apertura: z.coerce.number().min(0, "Apertura no puede ser negativa"),
  password: z.string().min(1, "Contraseña requerida"),
  observacion: z.string().optional().nullable(),
});

export const cerrarCajaSchema = z.object({
  cierre: z.coerce.number().min(0, "Cierre no puede ser negativo").optional(),
  observacion: z.string().optional().nullable(),
});

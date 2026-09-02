import { z } from "zod";

export const abrirCajaSchema = z.object({
  apertura: z.coerce.number().min(0, "Apertura no puede ser negativa"),
  password: z.string().min(1, "Contraseña requerida").max(128),
  observacion: z.string().trim().max(500).optional().nullable(),
});

export const cerrarCajaSchema = z.object({
  cierre: z.coerce.number().min(0, "Cierre no puede ser negativo").optional(),
  observacion: z.string().trim().max(500).optional().nullable(),
  conteo: z.object({
    billetes: z.record(z.coerce.number()).optional(),
    monedas: z.record(z.coerce.number()).optional(),
  }).optional().nullable(),
});

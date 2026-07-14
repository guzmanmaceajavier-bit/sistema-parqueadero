import { z } from "zod";

export const crearPuestoSchema = z.object({
  codigo: z.string().optional(),
  tipoPuesto: z.string().min(1, "Tipo de puesto es requerido"),
  zona: z.string().optional().nullable(),
  activo: z.boolean().optional().default(true),
});

export const crearPuestosMasivosSchema = z.object({
  prefijo: z.string().optional().default("Puesto"),
  cantidad: z.coerce.number().int().positive("Cantidad debe ser positiva"),
  tipoPuesto: z.string().optional().default("carro"),
  zona: z.string().optional().nullable(),
});

export const actualizarPuestoSchema = z.object({
  codigo: z.string().optional(),
  estado: z.enum(["LIBRE", "OCUPADO", "RESERVADO", "MANTENIMIENTO", "AUSENCIA"]).optional(),
  tipoPuesto: z.string().optional(),
  observacion: z.string().optional().nullable(),
  zona: z.string().optional().nullable(),
  activo: z.boolean().optional(),
});

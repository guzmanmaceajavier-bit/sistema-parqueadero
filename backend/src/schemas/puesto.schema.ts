import { z } from "zod";

export const crearPuestoSchema = z.object({
  codigo: z.string().trim().max(20).optional(),
  tipoPuesto: z.string().trim().min(1, "Tipo de puesto es requerido").max(100),
  zona: z.string().trim().max(50).optional().nullable(),
  activo: z.boolean().optional().default(true),
});

export const crearPuestosMasivosSchema = z.object({
  prefijo: z.string().trim().max(50).optional().default("Puesto"),
  cantidad: z.coerce.number().int().positive("Cantidad debe ser positiva").max(500),
  tipoPuesto: z.string().trim().max(100).optional().default("carro"),
  zona: z.string().trim().max(50).optional().nullable(),
});

export const actualizarPuestoSchema = z.object({
  codigo: z.string().trim().max(20).optional(),
  estado: z.enum(["LIBRE", "OCUPADO", "RESERVADO", "MANTENIMIENTO", "AUSENCIA"]).optional(),
  tipoPuesto: z.string().trim().max(100).optional(),
  observacion: z.string().trim().max(500).optional().nullable(),
  zona: z.string().trim().max(50).optional().nullable(),
  activo: z.boolean().optional(),
});

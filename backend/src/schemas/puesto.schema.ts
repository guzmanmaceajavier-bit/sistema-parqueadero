import { z } from "zod";

export const crearPuestoSchema = z.object({
  codigo: z.string().trim().optional().max(20),
  tipoPuesto: z.string().trim().min(1, "Tipo de puesto es requerido").max(100),
  zona: z.string().trim().optional().nullable().max(50),
  activo: z.boolean().optional().default(true),
});

export const crearPuestosMasivosSchema = z.object({
  prefijo: z.string().trim().optional().default("Puesto").max(50),
  cantidad: z.coerce.number().int().positive("Cantidad debe ser positiva").max(500),
  tipoPuesto: z.string().trim().optional().default("carro").max(100),
  zona: z.string().trim().optional().nullable().max(50),
});

export const actualizarPuestoSchema = z.object({
  codigo: z.string().trim().optional().max(20),
  estado: z.enum(["LIBRE", "OCUPADO", "RESERVADO", "MANTENIMIENTO", "AUSENCIA"]).optional(),
  tipoPuesto: z.string().trim().optional().max(100),
  observacion: z.string().trim().optional().nullable().max(500),
  zona: z.string().trim().optional().nullable().max(50),
  activo: z.boolean().optional(),
});

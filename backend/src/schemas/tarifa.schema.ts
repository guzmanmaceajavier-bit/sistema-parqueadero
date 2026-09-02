import { z } from "zod";

export const crearTarifaSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre es requerido").max(100),
  tipoVehiculo: z.string().trim().max(50).optional().default("carro"),
  modalidad: z.string().trim().max(30).optional().default("HORA"),
  valor: z.coerce.number().positive("Valor debe ser positivo"),
  minutosCortesia: z.coerce.number().int().min(0).optional().default(0),
  descripcion: z.string().trim().max(500).optional().nullable(),
});

export const actualizarTarifaSchema = z.object({
  nombre: z.string().trim().max(100).optional(),
  tipoVehiculo: z.string().trim().max(50).optional(),
  modalidad: z.string().trim().max(30).optional(),
  valor: z.coerce.number().positive().optional(),
  minutosCortesia: z.coerce.number().int().min(0).optional(),
  descripcion: z.string().trim().max(500).optional().nullable(),
  activa: z.boolean().optional(),
});

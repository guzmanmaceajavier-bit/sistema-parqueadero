import { z } from "zod";

export const crearTarifaSchema = z.object({
  nombre: z.string().min(1, "Nombre es requerido"),
  tipoVehiculo: z.string().optional().default("carro"),
  modalidad: z.string().optional().default("HORA"),
  valor: z.coerce.number().positive("Valor debe ser positivo"),
  minutosCortesia: z.coerce.number().int().min(0).optional().default(0),
  descripcion: z.string().optional().nullable(),
});

export const actualizarTarifaSchema = z.object({
  nombre: z.string().optional(),
  tipoVehiculo: z.string().optional(),
  modalidad: z.string().optional(),
  valor: z.coerce.number().positive().optional(),
  minutosCortesia: z.coerce.number().int().min(0).optional(),
  descripcion: z.string().optional().nullable(),
  activa: z.boolean().optional(),
});

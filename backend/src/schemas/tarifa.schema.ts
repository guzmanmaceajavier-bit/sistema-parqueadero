import { z } from "zod";

export const crearTarifaSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre es requerido").max(100),
  tipoVehiculo: z.string().trim().optional().default("carro").max(50),
  modalidad: z.string().trim().optional().default("HORA").max(30),
  valor: z.coerce.number().positive("Valor debe ser positivo"),
  minutosCortesia: z.coerce.number().int().min(0).optional().default(0),
  descripcion: z.string().trim().optional().nullable().max(500),
});

export const actualizarTarifaSchema = z.object({
  nombre: z.string().trim().optional().max(100),
  tipoVehiculo: z.string().trim().optional().max(50),
  modalidad: z.string().trim().optional().max(30),
  valor: z.coerce.number().positive().optional(),
  minutosCortesia: z.coerce.number().int().min(0).optional(),
  descripcion: z.string().trim().optional().nullable().max(500),
  activa: z.boolean().optional(),
});

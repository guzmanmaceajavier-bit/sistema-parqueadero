import { z } from "zod";

export const actualizarMensualidadSchema = z.object({
  vehiculoId: z.coerce.number().optional(),
  planId: z.coerce.number().optional().nullable(),
  puestoId: z.coerce.number().optional().nullable(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  valor: z.coerce.number().positive().optional(),
  observacion: z.string().optional().nullable(),
});

export const crearMensualidadSchema = z.object({
  clienteId: z.coerce.number({ required_error: "Cliente es requerido" }),
  vehiculoId: z.coerce.number({ required_error: "Vehículo es requerido" }),
  planId: z.coerce.number().optional().nullable(),
  puestoId: z.coerce.number().optional().nullable(),
  fechaInicio: z.string().refine(val => !isNaN(Date.parse(val)), "Fecha inválida"),
  fechaFin: z.string().refine(val => !isNaN(Date.parse(val)), "Fecha inválida"),
  valor: z.coerce.number().positive("Valor debe ser positivo"),
  observacion: z.string().optional().nullable(),
});

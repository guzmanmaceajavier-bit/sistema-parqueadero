import { z } from "zod";

export const crearReservaSchema = z.object({
  clienteId: z.coerce.number({ required_error: "Cliente es requerido" }),
  vehiculoId: z.coerce.number().optional().nullable(),
  puestoId: z.coerce.number().optional().nullable(),
  fechaInicio: z.string().refine(val => !isNaN(Date.parse(val)), "Fecha inválida"),
  fechaFin: z.string().optional().nullable(),
  observaciones: z.string().trim().optional().nullable().max(500),
});

export const actualizarReservaSchema = z.object({
  estado: z.enum(["PENDIENTE", "CONFIRMADA", "ACTIVA", "FINALIZADA", "CANCELADA", "NO_SHOW"]).optional(),
  vehiculoId: z.coerce.number().optional().nullable(),
  puestoId: z.coerce.number().optional().nullable(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional().nullable(),
  observaciones: z.string().trim().optional().nullable().max(500),
});

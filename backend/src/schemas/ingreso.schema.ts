import { z } from "zod";

export const crearIngresoSchema = z.object({
  clienteId: z.coerce.number({ required_error: "Cliente es requerido" }),
  vehiculoId: z.coerce.number({ required_error: "Vehículo es requerido" }),
  puestoId: z.coerce.number().optional().nullable(),
});

export const actualizarIngresoSchema = z.object({
  vehiculoId: z.coerce.number().optional(),
  puestoId: z.coerce.number().optional(),
});

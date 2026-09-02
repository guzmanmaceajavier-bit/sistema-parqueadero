import { z } from "zod";

export const OPCIONES_AUSENCIA = ["EXTENDER", "DESCONTAR", "CONGELAR", "MANTENER", "HISTORIAL"] as const;

export const crearAusenciaSchema = z.object({
  clienteId: z.coerce.number({ required_error: "Cliente es requerido" }),
  vehiculoId: z.coerce.number({ required_error: "Vehículo es requerido" }),
  fechaSalida: z.string().optional(),
  fechaRegreso: z.string().optional().nullable(),
  motivo: z.string().trim().max(500).optional().nullable(),
  opcion: z.enum(OPCIONES_AUSENCIA).optional(),
});

export const actualizarAusenciaSchema = z.object({
  fechaSalida: z.string().optional(),
  fechaRegreso: z.string().optional().nullable(),
  motivo: z.string().trim().max(500).optional().nullable(),
  opcion: z.enum(OPCIONES_AUSENCIA).optional(),
  estado: z.enum(["ACTIVA", "FINALIZADA"]).optional(),
});

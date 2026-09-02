import { z } from "zod";

const anyString = z.string().trim().optional().nullable().max(500).catch("");

export const crearClienteSchema = z.object({
  nombres: z.string().trim().min(1, "Nombre es requerido").max(100),
  apellidos: z.string().trim().min(1, "Apellidos son requeridos").max(100),
  documento: z.string().trim().min(1, "Documento es requerido").max(30),
  telefono: anyString,
  email: z.string().trim().email("Email inválido").optional().nullable().max(100),
  direccion: anyString,
  observaciones: anyString,
  estado: z.enum(["ACTIVO", "AUSENTE", "VENCIDO", "SUSPENDIDO", "MOROSO"]).optional().default("ACTIVO"),
  deseaReservar: z.boolean().optional().default(false),
});

export const actualizarClienteSchema = crearClienteSchema.partial().extend({
  bloqueado: z.boolean().optional(),
  saldo: z.number().min(0).optional(),
});

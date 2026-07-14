import { z } from "zod";

const anyString = z.string().optional().nullable().catch("");

export const crearClienteSchema = z.object({
  nombres: z.string().min(1, "Nombre es requerido"),
  apellidos: z.string().min(1, "Apellidos son requeridos"),
  documento: z.string().min(1, "Documento es requerido"),
  telefono: anyString,
  email: anyString,
  direccion: anyString,
  observaciones: anyString,
  estado: z.enum(["ACTIVO", "AUSENTE", "VENCIDO", "SUSPENDIDO", "MOROSO"]).optional().default("ACTIVO"),
  deseaReservar: z.boolean().optional().default(false),
});

export const actualizarClienteSchema = crearClienteSchema.partial();

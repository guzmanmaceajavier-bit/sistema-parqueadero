import { z } from "zod";

export const crearVehiculoSchema = z.object({
  placa: z.string().trim().min(3, "Placa debe tener al menos 3 caracteres").max(20).toUpperCase(),
  marca: z.string().trim().optional().nullable().max(50),
  modelo: z.string().trim().optional().nullable().max(50),
  color: z.string().trim().optional().nullable().max(30),
  tipo: z.enum(["moto", "carro", "camioneta", "bicicleta", "otro"]).optional().default("carro"),
  clase: z.enum(["particular", "publico", "carga", "electrico", "deportivo", "especial", "otro"]).optional().default("particular"),
  observaciones: z.string().trim().optional().nullable().max(500),
  clienteId: z.coerce.number({ required_error: "Cliente es requerido" }).nullable().optional(),
});

export const actualizarVehiculoSchema = crearVehiculoSchema.partial().extend({
  bloqueado: z.boolean().optional(),
});

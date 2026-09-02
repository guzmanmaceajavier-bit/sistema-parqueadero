import { z } from "zod";

export const crearVehiculoSchema = z.object({
  placa: z.string().trim().min(3, "Placa debe tener al menos 3 caracteres").max(20).toUpperCase(),
  marca: z.string().trim().max(50).optional().nullable(),
  modelo: z.string().trim().max(50).optional().nullable(),
  color: z.string().trim().max(30).optional().nullable(),
  tipo: z.enum(["moto", "carro", "camioneta", "bicicleta", "otro"]).optional().default("carro"),
  clase: z.enum(["particular", "publico", "carga", "electrico", "deportivo", "especial", "otro"]).optional().default("particular"),
  observaciones: z.string().trim().max(500).optional().nullable(),
  clienteId: z.coerce.number({ required_error: "Cliente es requerido" }).nullable().optional(),
});

export const actualizarVehiculoSchema = crearVehiculoSchema.partial().extend({
  bloqueado: z.boolean().optional(),
});

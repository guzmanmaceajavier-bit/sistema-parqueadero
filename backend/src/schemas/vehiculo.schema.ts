import { z } from "zod";

export const crearVehiculoSchema = z.object({
  placa: z.string().min(3, "Placa debe tener al menos 3 caracteres").toUpperCase(),
  marca: z.string().optional().nullable(),
  modelo: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  tipo: z.enum(["moto", "carro", "camioneta", "bicicleta", "otro"]).optional().default("carro"),
  clase: z.enum(["particular", "publico", "carga", "electrico", "deportivo", "especial", "otro"]).optional().default("particular"),
  observaciones: z.string().optional().nullable(),
  clienteId: z.coerce.number({ required_error: "Cliente es requerido" }).nullable().optional(),
});

export const actualizarVehiculoSchema = crearVehiculoSchema.partial();

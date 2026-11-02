import { z } from "zod";

const modalidadSchema = z.string().trim().min(1, "Modalidad es requerida").max(30).transform((value) => value.toLowerCase());
const valorOpcional = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? null : Number(value),
  z.number().finite().nonnegative("El valor no puede ser negativo").nullable()
);

export const crearTarifaSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre es requerido").max(100),
  tipoVehiculo: z.string().trim().min(1).max(100).default("todos"),
  modalidad: modalidadSchema.default("hora"),
  valor: z.coerce.number().finite().positive("Valor debe ser positivo"),
  minutosCortesia: z.coerce.number().int().min(0).max(1440).optional().default(0),
  minutosGratis: z.coerce.number().int().min(0).max(1440).optional().default(0),
  precioPrimeraHora: valorOpcional.optional(),
  precioHoraAdicional: valorOpcional.optional(),
  tarifaMaximaDiaria: valorOpcional.optional(),
  descripcion: z.string().trim().max(500).optional().nullable(),
});

export const actualizarTarifaSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  tipoVehiculo: z.string().trim().min(1).max(100).optional(),
  modalidad: modalidadSchema.optional(),
  valor: z.coerce.number().finite().positive("Valor debe ser positivo").optional(),
  minutosCortesia: z.coerce.number().int().min(0).max(1440).optional(),
  minutosGratis: z.coerce.number().int().min(0).max(1440).optional(),
  precioPrimeraHora: valorOpcional.optional(),
  precioHoraAdicional: valorOpcional.optional(),
  tarifaMaximaDiaria: valorOpcional.optional(),
  descripcion: z.string().trim().max(500).optional().nullable(),
  activa: z.boolean().optional(),
});

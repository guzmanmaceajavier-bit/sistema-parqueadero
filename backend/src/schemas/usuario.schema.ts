import { z } from "zod";

export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre debe tener al menos 2 caracteres").max(100),
  usuario: z.string().trim().min(3, "Usuario debe tener al menos 3 caracteres").max(50),
  correo: z.string().trim().email("Email inválido").max(100),
  password: z.string().min(8, "Contraseña debe tener al menos 8 caracteres").max(128),
  rol: z.enum(["admin", "supervisor", "empleado"]).optional().default("empleado"),
});

export const loginSchema = z.object({
  usuario: z.string().trim().max(50).optional(),
  correo: z.string().trim().email().max(100).optional(),
  password: z.string().min(1, "Contraseña requerida").max(128),
}).refine(data => data.usuario || data.correo, {
  message: "Debe proporcionar usuario o correo",
});

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().trim().min(2).max(100).optional(),
  correo: z.string().trim().email().max(100).optional(),
  rol: z.enum(["admin", "supervisor", "empleado"]).optional(),
  password: z.string().min(8).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Contraseña debe tener mayúscula, minúscula y número").optional(),
});

export const cambiarEstadoUsuarioSchema = z.object({
  estado: z.boolean(),
});

export const solicitarResetPasswordSchema = z.object({
  usuario: z.string().trim().max(50).optional(),
  correo: z.string().trim().email().max(100).optional(),
}).refine(data => data.usuario || data.correo, {
  message: "Debe proporcionar usuario o correo",
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Token es requerido").max(500),
  password: z.string().min(8, "Contraseña debe tener al menos 8 caracteres").max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Contraseña debe tener mayúscula, minúscula y número"),
});

export const verificarPasswordSchema = z.object({
  password: z.string().min(1, "Contraseña requerida").max(128),
});

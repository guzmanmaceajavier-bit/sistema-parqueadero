import { z } from "zod";

export const crearUsuarioSchema = z.object({
  nombre: z.string().min(2, "Nombre debe tener al menos 2 caracteres"),
  usuario: z.string().min(3, "Usuario debe tener al menos 3 caracteres"),
  correo: z.string().email("Email inválido"),
  password: z.string().min(8, "Contraseña debe tener al menos 8 caracteres"),
  rol: z.enum(["admin", "supervisor", "empleado"]).optional().default("empleado"),
});

export const loginSchema = z.object({
  usuario: z.string().optional(),
  correo: z.string().email().optional(),
  password: z.string().min(1, "Contraseña requerida"),
}).refine(data => data.usuario || data.correo, {
  message: "Debe proporcionar usuario o correo",
});

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().optional(),
  correo: z.string().email().optional(),
  rol: z.enum(["admin", "supervisor", "empleado"]).optional(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Contraseña debe tener mayúscula, minúscula y número").optional(),
});

export const cambiarEstadoUsuarioSchema = z.object({
  estado: z.boolean(),
});

export const solicitarResetPasswordSchema = z.object({
  usuario: z.string().optional(),
  correo: z.string().email().optional(),
}).refine(data => data.usuario || data.correo, {
  message: "Debe proporcionar usuario o correo",
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token es requerido"),
  password: z.string().min(8, "Contraseña debe tener al menos 8 caracteres").regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Contraseña debe tener mayúscula, minúscula y número"),
});

export const verificarPasswordSchema = z.object({
  password: z.string().min(1, "Contraseña requerida"),
});
